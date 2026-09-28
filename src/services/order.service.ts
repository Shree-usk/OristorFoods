import { randomBytes } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import * as orderRepository from "@/repositories/order.repository";
import type { CreateOrderInput } from "@/repositories/order.repository";
import { OrderForbiddenError, OrderNotFoundError, OrderNumberExhaustedError } from "@/services/order.errors";

/**
 * Order creation (STORY-028 thin slice — checkout is the only caller).
 * The status pipeline, cancellation, and ERP integration events land
 * with STORY-028 proper.
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
 * Order lookup for the confirmation view, authorized by session user or
 * the guest-cart cookie token snapshotted onto the order.
 */
export async function getOrderForConfirmation(orderNumber: string, userId: string | null, guestToken: string | null) {
  const order = await orderRepository.findOrderByNumber(orderNumber);
  if (!order) throw new OrderNotFoundError();
  assertOrderOwnership(order, userId, guestToken);
  return order;
}
