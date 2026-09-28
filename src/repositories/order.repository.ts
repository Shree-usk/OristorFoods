import { prisma } from "@/lib/db";
import { InsufficientStockError } from "@/services/order.errors";

/**
 * The only place Order/OrderItem/OrderStatusHistory are queried/mutated
 * (STORY-028 will extend this file with the status pipeline).
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
  return prisma.order.findUnique({ where: { orderNumber }, include: { items: true } });
}
