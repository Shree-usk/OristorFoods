import * as orderRepository from "@/repositories/order.repository";

/**
 * Order lifecycle integration hook (STORY-028) — a durable outbox for a
 * future ERP/warehouse system, not a call to any named ERP's API. Which
 * ERP system is unconfirmed per docs/blueprint.md Section 10; this is
 * intentionally scoped to the integration-point interface only, the same
 * treatment STORY-026 gives the payment gateway. See
 * docs/architecture-decisions.md for the full contract.
 *
 * Shape mirrors qa-notifications.ts's stub/registration pattern (default
 * logging consumer, swappable via a globalThis-held registration point
 * for instrumentation.ts once a real subscriber exists) but is backed by
 * a real table: every event is written to OrderIntegrationEvent BEFORE
 * the consumer runs, so a future poll-based worker has a durable queue
 * to replay from even if today's in-process consumer call fails.
 */

export type OrderEventType = "order.confirmed" | "order.cancelled";

/** Must stay JSON-serializable — this is written straight to the OrderIntegrationEvent.payload Json column. */
export interface OrderIntegrationEventPayload {
  orderNumber: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface OrderEventConsumer {
  onOrderEvent(eventId: string, type: OrderEventType, orderId: string, payload: OrderIntegrationEventPayload): Promise<void>;
}

const loggingConsumer: OrderEventConsumer = {
  async onOrderEvent(eventId, type, orderId) {
    console.info(`[order-integration] ${type} order=${orderId} event=${eventId} — no subscriber wired yet`);
  },
};

// STORY-031. Was a single `{ consumer }` slot — STORY-030's rewardsConsumer
// occupied it, and STORY-031's referralConsumer needs the same hook, so
// this is now a fan-out list. `loggingConsumer` only runs when nothing
// real has been registered yet (never alongside real consumers).
const globalForOrderEvents = globalThis as unknown as { __oristorOrderEventConsumers?: { consumers: OrderEventConsumer[] } };
const holder = (globalForOrderEvents.__oristorOrderEventConsumers ??= { consumers: [] });

/** Registers an additional subscriber (called once per real consumer from instrumentation.ts, or by a test). */
export function registerOrderEventConsumer(consumer: OrderEventConsumer): void {
  holder.consumers.push(consumer);
}

/** Test-only: clears every registered consumer, restoring the default logging fallback. */
export function resetOrderEventConsumerForTesting(): void {
  holder.consumers = [];
}

/**
 * Writes the outbox row, then best-effort invokes every registered
 * consumer independently — one consumer's failure never blocks another.
 * The event is marked Processed only if every consumer succeeded; Failed
 * (with the first error) otherwise. A failing/absent consumer never
 * throws back to the caller — order.service.ts calls this AFTER its
 * triggering transaction commits, never from inside one, so a consumer
 * failure can't roll back an order change it merely observes.
 */
export async function emitOrderEvent(type: OrderEventType, orderId: string, payload: OrderIntegrationEventPayload): Promise<void> {
  const event = await orderRepository.createIntegrationEvent(orderId, type, payload);
  const consumers = holder.consumers.length > 0 ? holder.consumers : [loggingConsumer];

  let firstError: unknown = null;
  for (const consumer of consumers) {
    try {
      await consumer.onOrderEvent(event.id, type, orderId, payload);
    } catch (error) {
      firstError ??= error;
      console.error(`[order-integration] a consumer failed for event ${event.id}`, error);
    }
  }

  if (firstError === null) {
    await orderRepository.markIntegrationEventProcessed(event.id);
  } else {
    await orderRepository.markIntegrationEventFailed(event.id, firstError instanceof Error ? firstError.message : String(firstError));
  }
}

/**
 * Proves the AC's "manual/mock sync-status update path" end to end
 * without a real ERP — flips Order.erpSyncStatus, which is the
 * business-visible field blueprint.md Section 7's admin dashboard reads.
 * This is distinct from OrderIntegrationEvent.status (outbox-processing
 * plumbing): a mock sync can succeed as a consumer call while still
 * representing "no real ERP synced anything." Exported but never
 * auto-registered — tests opt in explicitly via registerOrderEventConsumer.
 */
export const mockErpSyncConsumer: OrderEventConsumer = {
  async onOrderEvent(_eventId, type, orderId) {
    if (type === "order.confirmed") await orderRepository.updateErpSyncStatus(orderId, "synced");
    if (type === "order.cancelled") await orderRepository.updateErpSyncStatus(orderId, "sync_cancelled");
  },
};
