import { prisma } from "@/lib/db";
import { ConcurrentTransitionError, InsufficientStockError } from "@/services/order.errors";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";

/**
 * The only place Order/OrderItem/OrderStatusHistory/OrderIntegrationEvent
 * are queried/mutated.
 */

export interface OrderLineInput {
  productId: string;
  productName: string;
  productSku: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  rewardPointsEarned: number;
}

export interface CreateOrderInput {
  orderNumber: string;
  idempotencyKey: string;
  userId: string | null;
  guestToken: string | null;
  guestEmail: string | null;
  subtotal: string;
  deliveryCharge: string;
  grandTotal: string;
  rewardPointsEarned: number;
  paymentId: string;
  deliveryZoneName: string;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  shipRecipientName: string;
  shipPhone: string;
  shipLine1: string;
  shipLine2: string | null;
  shipCity: string;
  shipDistrict: string | null;
  shipPostalCode: string | null;
  items: OrderLineInput[];
  cartId: string;
}

/**
 * Atomic order placement. One transaction covers: conditional stock
 * decrement per line (the `stockQuantity >= quantity` row condition makes
 * concurrent purchases of the same stock safe — the loser's decrement
 * matches zero rows and the whole transaction rolls back, so overselling
 * and partial/ghost orders are both impossible), order + item snapshots +
 * initial status history, and clearing the cart's items. The cart row and
 * guest cookie survive — the cookie also authorizes the guest's
 * confirmation view via Order.guestToken.
 */
export function createOrderWithStockDecrement(input: CreateOrderInput) {
  return prisma.$transaction(async (tx) => {
    for (const line of input.items) {
      const decremented = await tx.product.updateMany({
        where: { id: line.productId, stockQuantity: { gte: line.quantity } },
        data: { stockQuantity: { decrement: line.quantity } },
      });
      if (decremented.count === 0) throw new InsufficientStockError(line.productName);
    }

    const order = await tx.order.create({
      data: {
        orderNumber: input.orderNumber,
        idempotencyKey: input.idempotencyKey,
        userId: input.userId,
        guestToken: input.guestToken,
        guestEmail: input.guestEmail,
        status: "Confirmed",
        subtotal: input.subtotal,
        deliveryCharge: input.deliveryCharge,
        grandTotal: input.grandTotal,
        rewardPointsEarned: input.rewardPointsEarned,
        paymentId: input.paymentId,
        deliveryZoneName: input.deliveryZoneName,
        estimatedDaysMin: input.estimatedDaysMin,
        estimatedDaysMax: input.estimatedDaysMax,
        shipRecipientName: input.shipRecipientName,
        shipPhone: input.shipPhone,
        shipLine1: input.shipLine1,
        shipLine2: input.shipLine2,
        shipCity: input.shipCity,
        shipDistrict: input.shipDistrict,
        shipPostalCode: input.shipPostalCode,
        items: {
          create: input.items.map((line) => ({
            productId: line.productId,
            productName: line.productName,
            productSku: line.productSku,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            lineTotal: line.lineTotal,
            rewardPointsEarned: line.rewardPointsEarned,
          })),
        },
        statusHistory: {
          create: [{ status: "Confirmed", actor: "system:checkout" }],
        },
      },
      include: { items: true },
    });

    await tx.cartItem.deleteMany({ where: { cartId: input.cartId } });

    return order;
  });
}

export function findOrderByIdempotencyKey(idempotencyKey: string) {
  return prisma.order.findUnique({ where: { idempotencyKey }, include: { items: true } });
}

export function findOrderByNumber(orderNumber: string) {
  return prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true, statusHistory: { orderBy: { createdAt: "asc" } } },
  });
}

export function findOrderById(orderId: string) {
  return prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
}

export async function listOrdersByUserId(userId: string, page: number, pageSize: number) {
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { items: true },
    }),
    prisma.order.count({ where: { userId } }),
  ]);
  return { orders, total };
}

/**
 * Plain status transition (no side effects beyond the status itself —
 * cancellation's stock release/extra columns go through
 * cancelOrderWithStockRelease instead). `status: expectedCurrentStatus`
 * in the where clause is the optimistic-concurrency guard: a concurrent
 * transition that already moved the order off that status matches zero
 * rows here rather than silently overwriting it.
 */
export async function applyStatusTransition(orderId: string, expectedCurrentStatus: OrderStatus, to: OrderStatus, actor: string) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: expectedCurrentStatus },
      data: { status: to },
    });
    if (updated.count === 0) throw new ConcurrentTransitionError();

    await tx.orderStatusHistory.create({ data: { orderId, status: to, actor } });
    return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  });
}

/**
 * Cancellation's atomic transaction: restocks every line (the direct
 * inverse of createOrderWithStockDecrement's conditional decrement — no
 * floor to guard on the way up), then writes Cancelled + cancelledAt +
 * cancellationReason under the same optimistic-concurrency guard as
 * applyStatusTransition, then records the history row.
 */
export async function cancelOrderWithStockRelease(orderId: string, expectedCurrentStatus: OrderStatus, reason: string | null, actor: string) {
  return prisma.$transaction(async (tx) => {
    const items = await tx.orderItem.findMany({ where: { orderId } });
    for (const line of items) {
      // A deleted product (SetNull on OrderItem.productId) has nothing
      // left to restock.
      if (!line.productId) continue;
      await tx.product.update({ where: { id: line.productId }, data: { stockQuantity: { increment: line.quantity } } });
    }

    const updated = await tx.order.updateMany({
      where: { id: orderId, status: expectedCurrentStatus },
      data: { status: "Cancelled", cancelledAt: new Date(), cancellationReason: reason },
    });
    if (updated.count === 0) throw new ConcurrentTransitionError();

    await tx.orderStatusHistory.create({ data: { orderId, status: "Cancelled", actor } });
    return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  });
}

export function createIntegrationEvent(orderId: string, eventType: string, payload: Prisma.InputJsonValue) {
  return prisma.orderIntegrationEvent.create({ data: { orderId, eventType, payload } });
}

export function markIntegrationEventProcessed(eventId: string) {
  return prisma.orderIntegrationEvent.update({ where: { id: eventId }, data: { status: "Processed", processedAt: new Date() } });
}

export function markIntegrationEventFailed(eventId: string, error: string) {
  return prisma.orderIntegrationEvent.update({ where: { id: eventId }, data: { status: "Failed", error } });
}

export function updateErpSyncStatus(orderId: string, erpSyncStatus: string) {
  return prisma.order.update({ where: { id: orderId }, data: { erpSyncStatus } });
}
