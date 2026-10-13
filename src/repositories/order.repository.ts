import { prisma } from "@/lib/db";
import { createRedemption } from "@/repositories/coupon.repository";
import { createRedeemedTransaction } from "@/repositories/rewards.repository";
import { ConcurrentTransitionError, InsufficientStockError } from "@/services/order.errors";
import type { FulfilmentMethod, OrderStatus, PaymentMethod, Prisma } from "@/generated/prisma/client";

/**
 * The only place Order/OrderItem/OrderStatusHistory/OrderIntegrationEvent
 * are queried/mutated.
 */

export interface OrderLineInput {
  productId: string;
  productName: string;
  productSku: string;
  variantId?: string | null;
  variantName?: string | null;
  variantSku?: string | null;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  rewardPointsEarned: number;
  /** Story 2 (Bundles). Flat snapshots, same convention as variantId/variantName — null for a plain line. */
  bundleId?: string | null;
  bundleInstanceId?: string | null;
  bundleName?: string | null;
  /** Story 3 (Custom Packaging). Flat snapshots — null for a line with no packaging selected. */
  packagingOptionId?: string | null;
  packagingMethodName?: string | null;
  packagingCharge?: string | null;
  packagingDeclaredAvailability?: "Local" | "Export" | null;
  packagingRequiresManualReview?: boolean;
  /** Export fulfilment flow. Snapshot of ProductPackagingOption.customerInstructions — null for a line with no packaging selected, or one whose option left it unset. */
  packagingInstructions?: string | null;
}

/** Story 2 (Bundles). One entry per distinct bundle instance in the order — only OwnStock ones trigger the bundle-level decrement/restock step below. */
export interface OrderBundleInstanceInput {
  bundleId: string;
  bundleInstanceId: string;
  quantity: number;
  stockMode: "Derived" | "OwnStock";
}

export interface CreateOrderInput {
  orderNumber: string;
  idempotencyKey: string;
  userId: string | null;
  guestToken: string | null;
  guestEmail: string | null;
  subtotal: string;
  deliveryCharge: string;
  // STORY-029. discount/couponCode/discountLabel are always written
  // (defaulting "0.00"/null/null when nothing applied) rather than left
  // to the schema default, so every order snapshot is explicit about
  // whether a discount was considered.
  discount: string;
  couponCode: string | null;
  discountLabel: string | null;
  // STORY-030. Always written (0/"0.00" when nothing redeemed), same
  // "explicit snapshot, never left to the schema default" reasoning as
  // discount/couponCode/discountLabel above.
  pointsRedeemed: number;
  pointsRedemptionValue: string;
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
  /** Story 2 (Bundles). Optional/defaults to empty — every pre-bundles caller omits it. */
  bundleInstances?: OrderBundleInstanceInput[];
  cartId: string;
  /** Present only when a coupon (not just a promotion) contributed to the discount — promotions aren't redemption-tracked, only coupons are. */
  couponRedemption: { couponId: string; discountAmount: string } | null;
  /** Present only when the customer redeemed points at this order's checkout. userId is required here (redemption is authenticated-only). */
  pointsRedemption: { userId: string; points: number } | null;
  /** Story 3 (Custom Packaging). True when any line's packaging option requires manual review — the order is created PendingConfirmation instead of Confirmed. Omitted/false for every pre-packaging caller, which still produces "Confirmed" byte-for-byte. */
  requiresManualReview?: boolean;
  /** Story 4 (Payment Restriction). Omitted only by pre-Story-4 test callers — the schema column defaults "Card" when omitted from the create data, matching every historical order's actual payment flow. */
  paymentMethod?: PaymentMethod;
  /** Export fulfilment flow. Omitted defaults "Delivery" at the DB level, matching every pre-existing order. Pickup is only ever passed by checkout.service.ts for an export-declared cart. */
  fulfilmentMethod?: FulfilmentMethod;
  /** Export fulfilment flow. Collected only for an export-declared cart (both Pickup and Delivery sub-choices) — null for every standard order. */
  travelerName?: string | null;
  travelerCountry?: string | null;
  travelerPhone?: string | null;
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
  // Story 3 (Custom Packaging). Every pre-packaging caller omits
  // requiresManualReview, so this is the literal string "Confirmed" for
  // them — byte-for-byte identical to before this story.
  const initialStatus: OrderStatus = input.requiresManualReview ? "PendingConfirmation" : "Confirmed";
  return prisma.$transaction(async (tx) => {
    // Story 2 (Bundles). An ADDITIONAL cap layered on top of every
    // component's own stock decrement below — never a substitute for it,
    // so a bundle can never oversell a component it shares with
    // non-bundle sales. Derived bundles (the default) have no counter to
    // touch here at all.
    for (const instance of input.bundleInstances ?? []) {
      if (instance.stockMode !== "OwnStock") continue;
      const decremented = await tx.productBundle.updateMany({
        where: { id: instance.bundleId, stockQuantity: { gte: instance.quantity } },
        data: { stockQuantity: { decrement: instance.quantity } },
      });
      if (decremented.count === 0) throw new InsufficientStockError("This bundle");
    }

    for (const line of input.items) {
      // A variant line decrements its own stock row, never the parent
      // Product's — the parent's stockQuantity is inert once variants
      // exist (see Product Variants story's design decision). Same
      // conditional-atomic-update idiom either way: zero rows matched
      // means someone else just took the last unit.
      const decremented = line.variantId
        ? await tx.productVariant.updateMany({
            where: { id: line.variantId, stockQuantity: { gte: line.quantity } },
            data: { stockQuantity: { decrement: line.quantity } },
          })
        : await tx.product.updateMany({
            where: { id: line.productId, stockQuantity: { gte: line.quantity } },
            data: { stockQuantity: { decrement: line.quantity } },
          });
      if (decremented.count === 0) throw new InsufficientStockError(line.variantName ? `${line.productName} — ${line.variantName}` : line.productName);
    }

    const order = await tx.order.create({
      data: {
        orderNumber: input.orderNumber,
        idempotencyKey: input.idempotencyKey,
        userId: input.userId,
        guestToken: input.guestToken,
        guestEmail: input.guestEmail,
        status: initialStatus,
        subtotal: input.subtotal,
        deliveryCharge: input.deliveryCharge,
        discount: input.discount,
        couponCode: input.couponCode,
        discountLabel: input.discountLabel,
        pointsRedeemed: input.pointsRedeemed,
        pointsRedemptionValue: input.pointsRedemptionValue,
        grandTotal: input.grandTotal,
        rewardPointsEarned: input.rewardPointsEarned,
        paymentId: input.paymentId,
        paymentMethod: input.paymentMethod,
        fulfilmentMethod: input.fulfilmentMethod,
        travelerName: input.travelerName,
        travelerCountry: input.travelerCountry,
        travelerPhone: input.travelerPhone,
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
            variantId: line.variantId,
            variantName: line.variantName,
            variantSku: line.variantSku,
            bundleId: line.bundleId,
            bundleInstanceId: line.bundleInstanceId,
            bundleName: line.bundleName,
            packagingOptionId: line.packagingOptionId,
            packagingMethodName: line.packagingMethodName,
            packagingCharge: line.packagingCharge,
            packagingDeclaredAvailability: line.packagingDeclaredAvailability,
            packagingRequiresManualReview: line.packagingRequiresManualReview ?? false,
            packagingInstructions: line.packagingInstructions,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            lineTotal: line.lineTotal,
            rewardPointsEarned: line.rewardPointsEarned,
          })),
        },
        statusHistory: {
          create: [{ status: initialStatus, actor: "system:checkout" }],
        },
      },
      include: { items: true },
    });

    await tx.cartItem.deleteMany({ where: { cartId: input.cartId } });
    // The cart's applied coupon/points-redemption request are scoped to
    // that checkout attempt — clear them alongside the items so the
    // customer starts their next cart fresh, mirroring how items
    // themselves are cleared.
    await tx.cart.update({ where: { id: input.cartId }, data: { couponId: null, pointsToRedeem: 0 } });

    if (input.couponRedemption) {
      await createRedemption(tx, {
        couponId: input.couponRedemption.couponId,
        userId: input.userId,
        guestEmail: input.guestEmail,
        orderId: order.id,
        discountAmount: input.couponRedemption.discountAmount,
      });
    }

    if (input.pointsRedemption) {
      // Written inside this same transaction — a rollback (e.g.
      // InsufficientStockError above) rolls back the points debit too,
      // so a failed order can never leave points debited with nothing
      // to show. See rewards.repository.ts::createRedeemedTransaction.
      await createRedeemedTransaction(tx, { userId: input.pointsRedemption.userId, orderId: order.id, points: input.pointsRedemption.points });
    }

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

/**
 * STORY-036. Additive — same include as findOrderByNumber plus `payment`,
 * for the order-detail page's payment summary. A separate function rather
 * than widening findOrderByNumber's own include, so STORY-028's existing
 * callers (checkout.service.ts::getConfirmation) keep their exact return
 * shape unchanged.
 */
export function findOrderByNumberWithPayment(orderNumber: string) {
  return prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true, statusHistory: { orderBy: { createdAt: "asc" } }, payment: true },
  });
}

export function findOrderById(orderId: string) {
  return prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
}

/**
 * Export fulfilment flow. A plain field write, deliberately independent
 * of OrderStatus's own transition state machine (readyForPickupAt is
 * informational/notification-triggering only, never a status) — an admin
 * can mark a Pickup order ready regardless of its current status. Returns
 * null if the order wasn't found or isn't a Pickup order, so the service
 * layer can distinguish "nothing to do" from "already marked ready"
 * (idempotent: a second call just re-sets the same timestamp).
 */
export async function markOrderReadyForPickup(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { fulfilmentMethod: true } });
  if (!order || order.fulfilmentMethod !== "Pickup") return null;

  return prisma.order.update({
    where: { id: orderId },
    data: { readyForPickupAt: new Date() },
    select: { id: true, orderNumber: true, userId: true, readyForPickupAt: true },
  });
}

/**
 * STORY-030. Counts ALL orders regardless of status (including
 * later-cancelled ones) — badge milestone counting is a deliberately
 * looser rule than the points ledger's strict clawback; see
 * docs/architecture-decisions.md.
 */
export function countOrdersByUserId(userId: string) {
  return prisma.order.count({ where: { userId } });
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

export interface OrderListFilters {
  status?: OrderStatus;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * STORY-036. Additive sibling of listOrdersByUserId with optional
 * status/date-range filters for the order-history page — kept separate so
 * STORY-028's own unfiltered callers (customer-dashboard.service.ts's
 * "recent orders" widget) are unaffected.
 */
export async function listOrdersByUserIdFiltered(userId: string, page: number, pageSize: number, filters: OrderListFilters) {
  const where: Prisma.OrderWhereInput = {
    userId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? { createdAt: { ...(filters.dateFrom ? { gte: filters.dateFrom } : {}), ...(filters.dateTo ? { lte: filters.dateTo } : {}) } }
      : {}),
  };
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { items: true },
    }),
    prisma.order.count({ where }),
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

    // Story 4 (Payment Restriction). Confirming a PendingConfirmation
    // bank-transfer order IS "the existing payment-verification workflow"
    // the brief asks for — no separate admin action, reusing the exact
    // generic status-transition button Story 3's packaging review already
    // uses. The linked Payment only flips Pending -> Succeeded here, never
    // backwards, and never for Card (already Succeeded via the mock
    // provider before checkout ever placed the order) or CashOnDelivery
    // (collected physically at delivery, outside this flow entirely).
    if (expectedCurrentStatus === "PendingConfirmation" && to === "Confirmed") {
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { paymentMethod: true, paymentId: true } });
      if (order.paymentMethod === "BankTransfer" && order.paymentId) {
        await tx.payment.updateMany({ where: { id: order.paymentId, status: "Pending" }, data: { status: "Succeeded" } });
      }
    }

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
      // A variant line restocks its own variant row, never the parent
      // Product's. A deleted product/variant (SetNull on OrderItem's FKs)
      // has nothing left to restock.
      if (line.variantId) {
        await tx.productVariant.update({ where: { id: line.variantId }, data: { stockQuantity: { increment: line.quantity } } });
      } else if (line.productId) {
        await tx.product.update({ where: { id: line.productId }, data: { stockQuantity: { increment: line.quantity } } });
      }
    }

    // Story 2 (Bundles). Direct inverse of createOrderWithStockDecrement's
    // OwnStock decrement step, applied once per distinct bundle instance
    // (always +1 — an instance is always exactly one bundle unit, see
    // bundle.service.ts) — a deleted bundle (SetNull on
    // OrderItem.bundleId) has nothing left to restock.
    const bundleInstances = new Map(items.filter((line) => line.bundleId && line.bundleInstanceId).map((line) => [line.bundleInstanceId as string, line.bundleId as string]));
    for (const bundleId of bundleInstances.values()) {
      const bundle = await tx.productBundle.findUnique({ where: { id: bundleId }, select: { stockMode: true } });
      if (bundle?.stockMode === "OwnStock") {
        await tx.productBundle.update({ where: { id: bundleId }, data: { stockQuantity: { increment: 1 } } });
      }
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

/**
 * STORY-039. Excludes Cancelled orders — a cancelled order never contributed
 * real revenue, mirroring countOrdersByUserId's own looser-vs-stricter
 * counting distinction documented above (this one takes the stricter side).
 */
export async function getOrderSummaryForRange(from: Date, to: Date) {
  const result = await prisma.order.aggregate({
    where: { createdAt: { gte: from, lte: to }, status: { not: "Cancelled" } },
    _sum: { grandTotal: true },
    _count: { _all: true },
  });
  return { orderCount: result._count._all, grandTotal: (result._sum.grandTotal ?? 0).toString() };
}

/** STORY-039. Dashboard's ERP Sync Status widget — Pending/Failed backlog plus the most recent successful sync. */
export async function getErpSyncStatus() {
  const [pending, failed, lastProcessed] = await Promise.all([
    prisma.orderIntegrationEvent.count({ where: { status: "Pending" } }),
    prisma.orderIntegrationEvent.count({ where: { status: "Failed" } }),
    prisma.orderIntegrationEvent.findFirst({
      where: { status: "Processed" },
      orderBy: { processedAt: "desc" },
      select: { processedAt: true },
    }),
  ]);
  return { pending, failed, lastProcessedAt: lastProcessed?.processedAt?.toISOString() ?? null };
}

// ---------------------------------------------------------------------------
// STORY-047. Admin orders console — unfiltered-by-owner (unlike every
// function above), so these are kept separate rather than relaxing the
// customer-scoped ones' own `where` clauses.
// ---------------------------------------------------------------------------

export interface OrderAdminListFilters {
  status?: OrderStatus;
  paymentStatus?: Prisma.PaymentWhereInput["status"];
  dateFrom?: Date;
  dateTo?: Date;
  /** Matches customer name, email, or the order number itself. */
  search?: string;
}

export async function listOrdersForAdmin(filters: OrderAdminListFilters, page: number, pageSize: number) {
  const where: Prisma.OrderWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.paymentStatus ? { payment: { status: filters.paymentStatus } } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? { createdAt: { ...(filters.dateFrom ? { gte: filters.dateFrom } : {}), ...(filters.dateTo ? { lte: filters.dateTo } : {}) } }
      : {}),
    ...(filters.search
      ? {
          OR: [
            { orderNumber: { contains: filters.search, mode: "insensitive" as const } },
            { shipRecipientName: { contains: filters.search, mode: "insensitive" as const } },
            { guestEmail: { contains: filters.search, mode: "insensitive" as const } },
            { user: { OR: [{ name: { contains: filters.search, mode: "insensitive" as const } }, { email: { contains: filters.search, mode: "insensitive" as const } }] } },
          ],
        }
      : {}),
  };
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { items: true, payment: true, user: { select: { name: true, email: true } } },
    }),
    prisma.order.count({ where }),
  ]);
  return { orders, total };
}

/**
 * STORY-047's return/RMA restock step — reuses the exact increment
 * pattern cancelOrderWithStockRelease already uses above, but scoped to
 * whichever specific order items the admin selected (a return can be
 * partial, unlike a cancellation, which always restocks the whole order).
 */
export async function restockOrderItems(items: { orderItemId: string; quantity: number }[]): Promise<void> {
  if (items.length === 0) return;
  const orderItemIds = items.map((item) => item.orderItemId);
  const lines = await prisma.orderItem.findMany({ where: { id: { in: orderItemIds } }, select: { id: true, productId: true, variantId: true } });
  const lineById = new Map(lines.map((line) => [line.id, line]));

  await prisma.$transaction(
    items
      .filter((item) => {
        const line = lineById.get(item.orderItemId);
        return line?.variantId || line?.productId;
      })
      .map((item) => {
        const line = lineById.get(item.orderItemId)!;
        return line.variantId
          ? prisma.productVariant.update({ where: { id: line.variantId }, data: { stockQuantity: { increment: item.quantity } } })
          : prisma.product.update({ where: { id: line.productId! }, data: { stockQuantity: { increment: item.quantity } } });
      }),
  );
}

export function findOrderAdminDetailById(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      payment: true,
      user: { select: { name: true, email: true } },
      returnRequests: { orderBy: { createdAt: "desc" } },
      refundRecords: { orderBy: { createdAt: "desc" } },
    },
  });
}
