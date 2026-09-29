import type { OrderStatus } from "@/generated/prisma/client";
import * as cartRepository from "@/repositories/cart.repository";
import { findProductsByIdsWithPrimaryImage } from "@/repositories/product.repository";
import * as orderRepository from "@/repositories/order.repository";
import type { OrderListFilters } from "@/repositories/order.repository";
import * as returnRequestRepository from "@/repositories/return-request.repository";
import { resolveCartIdentity } from "@/services/cart.service";
import { InvalidReturnQuantityError, OrderNotFoundError, OrderReturnNotAllowedError } from "@/services/order.errors";
import { getOrderForConfirmation } from "@/services/order.service";
import { resolvePrice } from "@/services/pricing.service";
import type { CheckoutAddress, OrderStatusHistoryEntry } from "@/types/checkout";

/**
 * STORY-036. Presentation-only composition for `/account/orders` and
 * `/account/orders/[orderNumber]` — reads and formats what STORY-028's
 * order.service.ts/order.repository.ts already compute, plus the reorder
 * and return-request logic that's genuinely new here. No order-status
 * rule, stock rule, or refund rule is defined in this file.
 */

function distinctProductIds(items: Array<{ productId: string | null }>): string[] {
  return [...new Set(items.map((item) => item.productId).filter((id): id is string => id !== null))];
}

// --- Order list ---

export interface OrderHistoryListItem {
  orderNumber: string;
  status: OrderStatus;
  placedAt: string;
  grandTotal: number;
  currency: string;
  itemCount: number;
  /** Up to 3 distinct product thumbnails for the order card. */
  thumbnailUrls: string[];
}

export interface OrderHistoryPage {
  orders: OrderHistoryListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getOrderListPage(userId: string, page: number, pageSize: number, filters: OrderListFilters = {}): Promise<OrderHistoryPage> {
  const { orders, total } = await orderRepository.listOrdersByUserIdFiltered(userId, page, pageSize, filters);

  const products = await findProductsByIdsWithPrimaryImage(distinctProductIds(orders.flatMap((order) => order.items)));
  const productById = new Map(products.map((product) => [product.id, product]));

  return {
    orders: orders.map((order) => ({
      orderNumber: order.orderNumber,
      status: order.status,
      placedAt: order.createdAt.toISOString(),
      grandTotal: order.grandTotal.toNumber(),
      currency: "LKR",
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      thumbnailUrls: order.items
        .map((item) => (item.productId ? productById.get(item.productId)?.images[0]?.url : undefined))
        .filter((url): url is string => Boolean(url))
        .slice(0, 3),
    })),
    total,
    page,
    pageSize,
  };
}

// --- Order detail ---

export interface OrderDetailLineItem {
  orderItemId: string;
  productId: string | null;
  productName: string;
  productSku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  imageUrl: string | null;
}

export interface OrderPaymentSummary {
  provider: string;
  status: string;
  amount: number;
  currency: string;
}

export interface OrderTracking {
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
}

export interface OrderDetail {
  orderNumber: string;
  status: OrderStatus;
  placedAt: string;
  shippingAddress: CheckoutAddress;
  items: OrderDetailLineItem[];
  subtotal: number;
  deliveryCharge: number;
  discount: number;
  discountLabel: string | null;
  couponCode: string | null;
  pointsRedeemed: number;
  pointsRedemptionValue: number;
  tax: number;
  grandTotal: number;
  currency: string;
  rewardPointsEarned: number;
  deliveryZoneName: string;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  statusHistory: OrderStatusHistoryEntry[];
  tracking: OrderTracking;
  payment: OrderPaymentSummary | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
}

/**
 * Ownership-checked via order.service.ts's getOrderForConfirmation (throws
 * OrderNotFoundError/OrderForbiddenError), then re-fetched through
 * findOrderByNumberWithPayment for the payment/tracking fields that
 * function's own lighter include doesn't carry.
 */
export async function getOrderDetail(orderNumber: string, userId: string): Promise<OrderDetail> {
  await getOrderForConfirmation(orderNumber, userId, null);
  const order = await orderRepository.findOrderByNumberWithPayment(orderNumber);
  if (!order) throw new OrderNotFoundError();

  const products = await findProductsByIdsWithPrimaryImage(distinctProductIds(order.items));
  const productById = new Map(products.map((product) => [product.id, product]));

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
    items: order.items.map((item) => ({
      orderItemId: item.id,
      productId: item.productId,
      productName: item.productName,
      productSku: item.productSku,
      unitPrice: item.unitPrice.toNumber(),
      quantity: item.quantity,
      lineTotal: item.lineTotal.toNumber(),
      imageUrl: (item.productId ? productById.get(item.productId)?.images[0]?.url : undefined) ?? null,
    })),
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
  };
}

// --- Reorder ---

export interface ReorderableLine {
  productId: string;
  productName: string;
  /** Already capped at live stock. */
  quantity: number;
}

export interface SkippedReorderLine {
  productName: string;
  reason: string;
}

export interface ReorderPlan {
  reorderable: ReorderableLine[];
  skipped: SkippedReorderLine[];
}

interface ReorderSourceLine {
  productId: string | null;
  productName: string;
  quantity: number;
}

interface ReorderStockLookup {
  status: string;
  inStock: boolean;
  stockQuantity: number;
}

/**
 * Pure — takes a stock/status lookup already fetched (product.repository's
 * findProductsByIdsWithPrimaryImage), rather than fetching it itself, so
 * this is unit-testable without a database. Mirrors the
 * status==="Published" && inStock && stockQuantity gating cart.service.ts's
 * requireAvailableProduct/mergeGuestCartIntoUser already use, so "still
 * purchasable" can't drift into a second definition.
 */
export function filterReorderableItems(items: ReorderSourceLine[], stockLookup: Map<string, ReorderStockLookup>): ReorderPlan {
  const reorderable: ReorderableLine[] = [];
  const skipped: SkippedReorderLine[] = [];

  for (const item of items) {
    const product = item.productId ? stockLookup.get(item.productId) : undefined;
    if (!item.productId || !product || product.status !== "Published" || !product.inStock) {
      skipped.push({ productName: item.productName, reason: "No longer available" });
      continue;
    }
    if (product.stockQuantity <= 0) {
      skipped.push({ productName: item.productName, reason: "Out of stock" });
      continue;
    }
    const cappedQuantity = Math.min(item.quantity, product.stockQuantity);
    reorderable.push({ productId: item.productId, productName: item.productName, quantity: cappedQuantity });
    if (cappedQuantity < item.quantity) {
      skipped.push({ productName: item.productName, reason: `Only ${cappedQuantity} left — added ${cappedQuantity} instead of ${item.quantity}` });
    }
  }

  return { reorderable, skipped };
}

export interface ReorderResult {
  addedCount: number;
  skipped: SkippedReorderLine[];
}

/**
 * Always session-authenticated (reachable only from `/account`) — no
 * guest-cart path needed, unlike cart.service.ts's own functions.
 */
export async function reorderPastOrder(userId: string, orderNumber: string): Promise<ReorderResult> {
  const order = await getOrderForConfirmation(orderNumber, userId, null);

  const products = await findProductsByIdsWithPrimaryImage(distinctProductIds(order.items));
  const stockLookup = new Map(products.map((product) => [product.id, { status: product.status, inStock: product.inStock, stockQuantity: product.stockQuantity }]));

  const { reorderable, skipped } = filterReorderableItems(
    order.items.map((item) => ({ productId: item.productId, productName: item.productName, quantity: item.quantity })),
    stockLookup,
  );
  if (reorderable.length === 0) return { addedCount: 0, skipped };

  const { cart } = await resolveCartIdentity(userId, undefined);
  const existingItems = await cartRepository.listCartItemsWithProduct(cart.id);
  const existingByProductId = new Map(existingItems.map((item) => [item.productId, item]));

  for (const line of reorderable) {
    const existing = existingByProductId.get(line.productId);
    const combinedQuantity = (existing?.quantity ?? 0) + line.quantity;
    const stock = stockLookup.get(line.productId)!.stockQuantity;
    const cappedQuantity = Math.min(combinedQuantity, stock);
    if (cappedQuantity <= 0) continue;

    const resolved = await resolvePrice({ productId: line.productId, customerGroup: "Retail", quantity: cappedQuantity });
    const unitPrice = resolved?.price.toFixed(2) ?? "0.00";

    if (existing) {
      await cartRepository.updateCartItemQuantity(existing.id, cappedQuantity);
      await cartRepository.updateCartItemSnapshot(existing.id, unitPrice);
    } else {
      await cartRepository.upsertCartItem(cart.id, line.productId, cappedQuantity, unitPrice);
    }
  }

  return { addedCount: reorderable.length, skipped };
}

// --- Return request ---

export interface ReturnRequestItemInput {
  orderItemId: string;
  quantity: number;
}

export interface CreateReturnRequestInput {
  reason: string;
  items: ReturnRequestItemInput[];
}

/**
 * Only a Delivered order can be returned (AC). Requested quantities are
 * validated against the order's own snapshot lines — a return can never
 * claim more of an item than was actually ordered.
 */
export async function createReturnRequest(userId: string, orderNumber: string, input: CreateReturnRequestInput) {
  const order = await getOrderForConfirmation(orderNumber, userId, null);
  if (order.status !== "Delivered") throw new OrderReturnNotAllowedError(order.status);

  const orderItemById = new Map(order.items.map((item) => [item.id, item]));
  const snapshot = input.items.map((requested) => {
    const orderItem = orderItemById.get(requested.orderItemId);
    if (!orderItem || requested.quantity > orderItem.quantity) throw new InvalidReturnQuantityError();
    return { orderItemId: orderItem.id, productName: orderItem.productName, quantity: requested.quantity };
  });

  return returnRequestRepository.createReturnRequest(order.id, input.reason, snapshot);
}
