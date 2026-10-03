/**
 * STORY-056. The pluggable sync target for the generic ERP Integration
 * Console's SyncJob queue — deliberately NOT a named ERP's API, since
 * the real system is still unconfirmed (docs/blueprint.md Section 10,
 * same treatment STORY-026 gave the payment gateway). `stubConnector`
 * is the only implementation today; a future story wires a real one
 * via `registerSyncConnector()` once the ERP is confirmed.
 *
 * Single-slot swappable registration, same shape as qa-notifications.ts
 * (one active connector at a time, not a fan-out list — unlike
 * order-integration.service.ts's multi-consumer OrderEventConsumer,
 * nothing here needs more than one sync target). Kept on globalThis for
 * the same reason as every other registration point in this codebase:
 * instrumentation.ts is bundled separately from route code.
 */

export interface SyncJobInput {
  id: string;
  jobType: string;
  targetEntityType: string | null;
  targetEntityId: string | null;
  payload: Record<string, unknown> | null;
}

export interface SyncResult {
  success: boolean;
  errorMessage?: string;
}

export interface SyncConnector {
  push(job: SyncJobInput): Promise<SyncResult>;
}

/**
 * Always succeeds, UNLESS `payload.forceFailure === true` — an explicit
 * test/demo hook on the stub itself (not a branch in sync-job.service.ts),
 * so e2e tests and manual demos can reliably exercise the retry path.
 */
export const stubConnector: SyncConnector = {
  async push(job) {
    console.info(`[sync-connector] stub push for job ${job.id} (${job.jobType}) — no real ERP connected yet`);
    if (job.payload?.forceFailure === true) {
      return { success: false, errorMessage: "Forced failure (test/demo hook via payload.forceFailure)." };
    }
    return { success: true };
  },
};

const globalForSyncConnector = globalThis as unknown as { __oristorSyncConnector?: { connector: SyncConnector } };
const holder = (globalForSyncConnector.__oristorSyncConnector ??= { connector: stubConnector });

export function registerSyncConnector(connector: SyncConnector): void {
  holder.connector = connector;
}

/** Test-only: restores the default stub connector. */
export function resetSyncConnectorForTesting(): void {
  holder.connector = stubConnector;
}

export function getSyncConnector(): SyncConnector {
  return holder.connector;
}
