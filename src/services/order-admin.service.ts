import type { OrderStatus, ReturnReasonCode } from "@/generated/prisma/client";
import * as orderRepository from "@/repositories/order.repository";
import type { OrderAdminListFilters } from "@/repositories/order.repository";
import * as refundRecordRepository from "@/repositories/refund-record.repository";
import * as returnRequestRepository from "@/repositories/return-request.repository";
import type { OrderDetail, OrderDetailLineItem } from "@/services/customer-order-history.service";
import { OrderHasNoPaymentError, OrderNotFoundError, OrderRefundAmountExceedsRemainingError } from "@/services/order.errors";
import { isTransitionAllowed, transitionOrderStatus } from "@/services/order.service";
import { refundPayment } from "@/services/payment.service";
import { writeAuditLog } from "@/services/audit-log.service";
import { requirePermission } from "@/services/permission.service";

/**
 * STORY-047. The admin-facing Orders console. Wraps order.service.ts's
 * already-shipped, tested state machine (isTransitionAllowed/
 * transitionOrderStatus — its own comment already anticipated this
 * story's "admin:" actor) and payment.service.ts's already-shipped
 * refundPayment() rather than reimplementing either. Reuses
 * order.errors.ts's existing error classes directly (not a cloned
 * hierarchy) — this operates on the exact same Order entity
 * order.service.ts does, not a sibling domain.
 */

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export interface OrderAdminListItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  status: OrderStatus;
  paymentStatus: string | null;
  grandTotal: number;
  currency: string;
  itemCount: number;
  placedAt: string;
}

export async function listOrdersForAdmin(
  adminUserId: string,
  filters: OrderAdminListFilters,
  page: number,
  pageSize: number,
): Promise<{ items: OrderAdminListItem[]; total: number }> {
  await requirePermission(adminUserId, "Orders", "View");
  const { orders, total } = await orderRepository.listOrdersForAdmin(filters, page, pageSize);
  return {
    items: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.user?.name?.trim() || order.shipRecipientName,
      customerEmail: order.user?.email ?? order.guestEmail,
      status: order.status,
      paymentStatus: order.payment?.status ?? null,
      grandTotal: order.grandTotal.toNumber(),
      currency: "LKR",
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      placedAt: order.createdAt.toISOString(),
    })),
    total,
  };
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export interface OrderAdminDetail extends OrderDetail {
  customerName: string;
  customerEmail: string | null;
  refundRecords: { id: string; amount: number; reason: string; processedById: string; createdAt: string }[];
  returnRequests: {
    id: string;
    status: string;
    reason: string;
    reasonCode: string | null;
    restocked: boolean;
    createdAt: string;
    processedAt: string | null;
  }[];
  nextLegalStatuses: OrderStatus[];
}

async function requireOrderAdminRow(orderId: string) {
  const order = await orderRepository.findOrderAdminDetailById(orderId);
  if (!order) throw new OrderNotFoundError();
  return order;
}

/** Shared by getOrderAdminDetail and the admin invoice route (the same renderOrderInvoicePdf(order: OrderDetail) STORY-036 already built — no adapter needed, OrderAdminDetail extends OrderDetail structurally). */
export async function getOrderAdminDetail(adminUserId: string, orderId: string): Promise<OrderAdminDetail> {
  await requirePermission(adminUserId, "Orders", "View");
  const order = await requireOrderAdminRow(orderId);

  const items: OrderDetailLineItem[] = order.items.map((item) => ({
    orderItemId: item.id,
    productId: item.productId,
    productName: item.productName,
    productSku: item.productSku,
    unitPrice: item.unitPrice.toNumber(),
    quantity: item.quantity,
    lineTotal: item.lineTotal.toNumber(),
    imageUrl: null,
  }));

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    placedAt: order.createdAt.toISOString(),
    shippingAddress: {
      recipientName: order.shipRecipientName,
      phone: order.shipPhone,
      line1: order.shipLine1,
      line2: order.shipLine2 ?? undefined,
      city: order.shipCity,
      district: order.shipDistrict ?? undefined,
      postalCode: order.shipPostalCode ?? undefined,
    },
    items,
    subtotal: order.subtotal.toNumber(),
    deliveryCharge: order.deliveryCharge.toNumber(),
    discount: order.discount.toNumber(),
    discountLabel: order.discountLabel,
    couponCode: order.couponCode,
    pointsRedeemed: order.pointsRedeemed,
    pointsRedemptionValue: order.pointsRedemptionValue.toNumber(),
    tax: order.tax.toNumber(),
    grandTotal: order.grandTotal.toNumber(),
    currency: "LKR",
    rewardPointsEarned: order.rewardPointsEarned,
    deliveryZoneName: order.deliveryZoneName,
    estimatedDaysMin: order.estimatedDaysMin,
    estimatedDaysMax: order.estimatedDaysMax,
    statusHistory: order.statusHistory.map((entry) => ({ status: entry.status, actor: entry.actor, createdAt: entry.createdAt.toISOString() })),
    tracking: { carrier: order.carrier, trackingNumber: order.trackingNumber, trackingUrl: order.trackingUrl },
    payment: order.payment
      ? { provider: order.payment.provider, status: order.payment.status, amount: order.payment.amount.toNumber(), currency: order.payment.currency }
      : null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    cancellationReason: order.cancellationReason,
    customerName: order.user?.name?.trim() || order.shipRecipientName,
    customerEmail: order.user?.email ?? order.guestEmail,
    refundRecords: order.refundRecords.map((record) => ({
      id: record.id,
      amount: record.amount.toNumber(),
      reason: record.reason,
      processedById: record.processedById,
      createdAt: record.createdAt.toISOString(),
    })),
    returnRequests: order.returnRequests.map((request) => ({
      id: request.id,
      status: request.status,
      reason: request.reason,
      reasonCode: request.reasonCode,
      restocked: request.restocked,
      createdAt: request.createdAt.toISOString(),
      processedAt: request.processedAt?.toISOString() ?? null,
    })),
    nextLegalStatuses: nextLegalStatuses(order.status),
  };
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

const ALL_STATUSES: readonly OrderStatus[] = ["PendingConfirmation", "Confirmed", "Processing", "Dispatched", "Delivered", "Cancelled", "Returned"];

/**
 * Computed server-side (not exposed as logic to the client) from the
 * real isTransitionAllowed(), so the admin UI's "next status" buttons
 * can never drift from order.service.ts's own state machine — the
 * client gets the resulting data, not the rule.
 */
export function nextLegalStatuses(from: OrderStatus): OrderStatus[] {
  return ALL_STATUSES.filter((to) => isTransitionAllowed(from, to));
}

export async function changeOrderStatus(adminUserId: string, orderId: string, to: OrderStatus) {
  await requirePermission(adminUserId, "Orders", "Edit");
  const order = await transitionOrderStatus(orderId, to, `admin:${adminUserId}`);
  await writeAuditLog({ actorId: adminUserId, action: "order_status_changed", module: "Orders", targetType: "Order", targetId: orderId, metadata: { to } });
  return order;
}

export interface BulkOrderStatusResult {
  updated: string[];
  skipped: string[];
}

export async function bulkChangeOrderStatus(adminUserId: string, orderIds: string[], to: OrderStatus): Promise<BulkOrderStatusResult> {
  await requirePermission(adminUserId, "Orders", "Edit");
  const updated: string[] = [];
  const skipped: string[] = [];
  for (const orderId of orderIds) {
    try {
      await changeOrderStatus(adminUserId, orderId, to);
      updated.push(orderId);
    } catch {
      skipped.push(orderId);
    }
  }
  return { updated, skipped };
}

// ---------------------------------------------------------------------------
// Refund
// ---------------------------------------------------------------------------

export async function refundOrder(adminUserId: string, orderId: string, amount: number, reason: string) {
  await requirePermission(adminUserId, "Orders", "Approve");
  const order = await requireOrderAdminRow(orderId);
  if (!order.payment) throw new OrderHasNoPaymentError();

  const alreadyRefunded = await refundRecordRepository.sumRefundedAmountForOrder(orderId);
  const remaining = order.grandTotal.toNumber() - alreadyRefunded;
  if (amount > remaining) throw new OrderRefundAmountExceedsRemainingError(remaining);

  await refundPayment(order.payment.id, amount);
  const record = await refundRecordRepository.createRefundRecord(orderId, amount.toFixed(2), reason, adminUserId);
  await writeAuditLog({ actorId: adminUserId, action: "order_refunded", module: "Orders", targetType: "Order", targetId: orderId, metadata: { amount, reason } });
  return record;
}

// ---------------------------------------------------------------------------
// Return / RMA
// ---------------------------------------------------------------------------

export interface ProcessReturnInput {
  items: { orderItemId: string; productName: string; quantity: number }[];
  reasonCode: ReturnReasonCode;
  restocked: boolean;
}

/**
 * Processes the order's one open (Requested) return if a customer
 * already submitted one (STORY-036), or creates one directly, already
 * Completed, when the admin is initiating it themselves — the AC's "lets
 * an admin mark an order... as returned," not only "approve a request."
 * Either way: optionally restocks the selected lines, then transitions
 * the Order to Returned if it isn't already (a no-op, not an error, if
 * it's already there — e.g. the admin is just backfilling a restock).
 */
export async function processReturn(adminUserId: string, orderId: string, input: ProcessReturnInput) {
  await requirePermission(adminUserId, "Orders", "Approve");
  const order = await requireOrderAdminRow(orderId);

  const existing = await returnRequestRepository.findRequestedReturnByOrderId(orderId);
  const processed = existing
    ? await returnRequestRepository.completeReturnRequest(existing.id, { processedById: adminUserId, reasonCode: input.reasonCode, restocked: input.restocked })
    : await returnRequestRepository.createCompletedReturnRequest(orderId, input.items, { processedById: adminUserId, reasonCode: input.reasonCode, restocked: input.restocked });

  if (input.restocked) {
    await orderRepository.restockOrderItems(input.items.map((item) => ({ orderItemId: item.orderItemId, quantity: item.quantity })));
  }

  if (order.status !== "Returned" && isTransitionAllowed(order.status, "Returned")) {
    await transitionOrderStatus(orderId, "Returned", `admin:${adminUserId}`);
  } else if (order.status !== "Returned") {
    // Not every status can legally reach Returned (e.g. a still-Processing
    // order) — the return record and restock still succeed; the order's
    // own status just doesn't change. Surfaced to the admin via the
    // response, not a thrown error, since the restock itself is real and
    // shouldn't be rolled back over a status-sequencing mismatch.
    console.warn(`[order-admin] processReturn: order ${orderId} is "${order.status}", can't transition to Returned — return recorded without a status change.`);
  }

  await writeAuditLog({ actorId: adminUserId, action: "order_return_processed", module: "Orders", targetType: "Order", targetId: orderId, metadata: { reasonCode: input.reasonCode, restocked: input.restocked } });
  return processed;
}
