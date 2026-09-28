import { randomBytes } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import type { OrderStatus } from "@/generated/prisma/client";
import * as orderRepository from "@/repositories/order.repository";
import type { CreateOrderInput } from "@/repositories/order.repository";
import { emitOrderEvent } from "@/services/order-integration.service";
import {
  IllegalOrderTransitionError,
  OrderCancellationNotAllowedError,
  OrderForbiddenError,
  OrderNotFoundError,
  OrderNumberExhaustedError,
} from "@/services/order.errors";
import { refundPayment } from "@/services/payment.service";
import type { OrderListResult } from "@/types/order";

/**
 * Order creation, the status-transition state machine, cancellation, and
 * ERP-integration event emission (STORY-028).
 */

// Crockford base-32: no I/L/O/U, so order numbers read unambiguously
// over the phone. Random, DB-unique-constrained, retried on collision —
// never `count + 1`, which double-issues under concurrency.
const ORDER_NUMBER_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ORDER_NUMBER_SUFFIX_LENGTH = 6;
const ORDER_NUMBER_MAX_ATTEMPTS = 5;

export function generateOrderNumber(now: Date = new Date()): string {
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const bytes = randomBytes(ORDER_NUMBER_SUFFIX_LENGTH);
  let suffix = "";
  for (let i = 0; i < ORDER_NUMBER_SUFFIX_LENGTH; i += 1) {
    suffix += ORDER_NUMBER_ALPHABET[bytes[i] % ORDER_NUMBER_ALPHABET.length];
  }
  return `ORS-${date}-${suffix}`;
}

function isUniqueViolationOn(error: unknown, field: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.includes(field);
  return typeof target === "string" && target.includes(field);
}

export type PlacedOrder = Awaited<ReturnType<typeof orderRepository.createOrderWithStockDecrement>>;

export interface CreateOrderResult {
  order: PlacedOrder;
  /** True when an idempotent replay returned a previously created order. */
  replayed: boolean;
}

function assertOrderOwnership(order: { userId: string | null; guestToken: string | null }, userId: string | null, guestToken: string | null) {
  const owned = userId !== null ? order.userId === userId : order.guestToken !== null && order.guestToken === guestToken;
  if (!owned) throw new OrderForbiddenError();
}

/**
 * Creates the order atomically (see order.repository.ts). Idempotency:
 * the DB unique constraint on idempotencyKey — not application logic —
 * is the arbiter under concurrency. If another request already created
 * the order for this key, that order is returned (after an ownership
 * check, so a guessed key can never fetch someone else's order) and no
 * stock is decremented twice.
 */
export async function createOrder(input: Omit<CreateOrderInput, "orderNumber">): Promise<CreateOrderResult> {
  const existing = await orderRepository.findOrderByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    assertOrderOwnership(existing, input.userId, input.guestToken);
    return { order: existing, replayed: true };
  }

  for (let attempt = 0; attempt < ORDER_NUMBER_MAX_ATTEMPTS; attempt += 1) {
    try {
      const order = await orderRepository.createOrderWithStockDecrement({ ...input, orderNumber: generateOrderNumber() });
      // Fired only for a genuinely new order — a replay (above) already
      // emitted this on the original request; emitting again on every
      // retried request would duplicate the ERP/notification hook. Runs
      // AFTER the order's own transaction has committed, and is wrapped
      // here so that even an outbox-write failure can never turn an
      // already-successful order creation into an error response — the
      // customer's order exists either way.
      try {
        await emitOrderEvent("order.confirmed", order.id, {
          orderNumber: order.orderNumber,
          rewardPointsEarned: order.rewardPointsEarned,
        });
      } catch (emitError) {
        console.error(`[order-integration] failed to record order.confirmed for order ${order.orderNumber}`, emitError);
      }
      return { order, replayed: false };
    } catch (error) {
      if (isUniqueViolationOn(error, "idempotencyKey")) {
        // A concurrent request with the same key won the insert.
        const winner = await orderRepository.findOrderByIdempotencyKey(input.idempotencyKey);
        if (winner) {
          assertOrderOwnership(winner, input.userId, input.guestToken);
          return { order: winner, replayed: true };
        }
        throw error;
      }
      if (isUniqueViolationOn(error, "orderNumber")) continue; // regenerate and retry
      throw error;
    }
  }
  throw new OrderNumberExhaustedError();
}

/**
 * Order lookup for the confirmation/detail view, authorized by session
 * user or the guest-cart cookie token snapshotted onto the order.
 */
export async function getOrderForConfirmation(orderNumber: string, userId: string | null, guestToken: string | null) {
  const order = await orderRepository.findOrderByNumber(orderNumber);
  if (!order) throw new OrderNotFoundError();
  assertOrderOwnership(order, userId, guestToken);
  return order;
}

/**
 * Paginated order-summary list for the authenticated customer
 * (session-only — a guest has no durable identity to list orders across
 * visits; each guest order stays reachable individually via its own
 * cookie through getOrderForConfirmation).
 */
export async function listOrdersForUser(userId: string, page: number, pageSize: number): Promise<OrderListResult> {
  const { orders, total } = await orderRepository.listOrdersByUserId(userId, page, pageSize);
  return {
    orders: orders.map((order) => ({
      orderNumber: order.orderNumber,
      status: order.status,
      grandTotal: order.grandTotal.toNumber(),
      currency: "LKR",
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: order.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  };
}

// --- Status transitions ---
//
// Pure, independently-testable adjacency table — deliberately not derived
// from any business logic elsewhere, so a reviewer can audit the entire
// legal state graph at a glance. Cancelled/Returned are terminal (no
// outgoing edges). Self-transitions are illegal: a repeated/duplicate
// transition request should be rejected, not silently no-op'd, so a
// caller bug surfaces instead of hiding. PendingConfirmation is
// currently unreachable in this codebase — checkout only ever creates
// orders after payment is verified Succeeded, so every order is created
// Confirmed — but the edge is kept for a future pay-later flow (see
// docs/architecture-decisions.md).
const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PendingConfirmation: ["Confirmed", "Cancelled"],
  Confirmed: ["Processing", "Cancelled"],
  Processing: ["Dispatched", "Cancelled"],
  Dispatched: ["Delivered", "Returned"],
  Delivered: ["Returned"],
  Cancelled: [],
  Returned: [],
};

export function isTransitionAllowed(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Actor tag recorded on OrderStatusHistory. The DB column stays a plain
 * string (unchanged) — this union exists only at the TypeScript call-site
 * boundary so a caller can't typo/free-type an actor tag.
 */
export type OrderActor = `system:${string}` | `customer:${string}` | `admin:${string}`;

/**
 * Internal, non-public transition method — no API route wraps this. It
 * is usable directly by checkout (system actor), a future admin action
 * once STORY-038/047 exist (admin actor), and the mock ERP-sync test
 * path, per this story's own scope: an admin-usable capability with no
 * admin auth to gate a route with is a service function, not a route.
 */
export async function transitionOrderStatus(orderId: string, to: OrderStatus, actor: OrderActor): Promise<PlacedOrder> {
  const order = await orderRepository.findOrderById(orderId);
  if (!order) throw new OrderNotFoundError();
  if (!isTransitionAllowed(order.status, to)) throw new IllegalOrderTransitionError(order.status, to);

  return orderRepository.applyStatusTransition(orderId, order.status, to, actor);
}

export interface CancelOrderResult {
  order: PlacedOrder;
  refundOutcome: "refunded" | "skipped_no_payment" | "refund_failed";
}

/**
 * Customer-initiated cancellation, ownership- and transition-table-gated
 * (the same isTransitionAllowed() the guarded transition above uses, so
 * the eligibility rule can't drift into two different answers). Restocks
 * every line, then calls payment.service.ts's existing refundPayment() —
 * no refund logic is reimplemented here.
 *
 * A refund failure does NOT roll back the cancellation. By the time
 * refundPayment runs, stock has already been released and could be
 * resold — reversing the cancellation would silently undo something the
 * customer was already told succeeded, a worse failure mode than a
 * delayed refund. The caller gets `refundOutcome` back so the UI can say
 * "cancelled; your refund may take longer than usual" instead of falsely
 * claiming an instant refund. See docs/architecture-decisions.md.
 */
export async function cancelOrder(
  orderNumber: string,
  userId: string | null,
  guestToken: string | null,
  reason: string | undefined,
): Promise<CancelOrderResult> {
  const existing = await orderRepository.findOrderByNumber(orderNumber);
  if (!existing) throw new OrderNotFoundError();
  assertOrderOwnership(existing, userId, guestToken);
  if (!isTransitionAllowed(existing.status, "Cancelled")) throw new OrderCancellationNotAllowedError(existing.status);

  const actor: OrderActor = userId ? `customer:${userId}` : "customer:guest";
  const order = await orderRepository.cancelOrderWithStockRelease(existing.id, existing.status, reason ?? null, actor);

  let refundOutcome: CancelOrderResult["refundOutcome"] = "skipped_no_payment";
  if (existing.paymentId) {
    try {
      await refundPayment(existing.paymentId);
      refundOutcome = "refunded";
    } catch (error) {
      refundOutcome = "refund_failed";
      console.error(`[order-cancel] refund failed for order ${order.orderNumber}, payment ${existing.paymentId}`, error);
    }
  }

  try {
    await emitOrderEvent("order.cancelled", order.id, {
      orderNumber: order.orderNumber,
      rewardPointsEarned: order.rewardPointsEarned,
      refundOutcome,
    });
  } catch (emitError) {
    console.error(`[order-integration] failed to record order.cancelled for order ${order.orderNumber}`, emitError);
  }

  return { order, refundOutcome };
}
