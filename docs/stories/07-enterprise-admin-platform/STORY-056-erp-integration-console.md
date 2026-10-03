# STORY-056: ERP Integration Console

**Status:** Done (generic sync-log/retry shell — no real ERP connected, see Scope Decision)
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Super Administrator, Warehouse Manager, Finance Manager, Production Manager

## User Story
As a Warehouse Manager, I want to monitor the ERP sync queue and retry failed jobs, so that inventory and order data stays consistent between ODEP and the back-office ERP without waiting on engineering.
As a Super Administrator, I want to manually trigger a sync for a given data type, so that I can force a refresh when I know upstream data has changed.

## Description
This story delivers the ERP Integration Console module from `docs/blueprint.md` Section 7: "sync queue monitoring, failed job retry." Per Section 10, the specific ERP system being integrated with is an unconfirmed open item — "the spec assumes ERP sync exists but doesn't name the system." This story is deliberately scoped to a generic, provider-agnostic sync-log/retry interface (queue, job status, retry, error detail) rather than building against any named ERP's API. The actual connector/adapter for a specific ERP is explicitly out of scope until the system is confirmed with the client.

## Acceptance Criteria
- [x] A sync queue view lists sync jobs (type, e.g. Order Export / Stock Import / Product Sync), status (Queued/Processing/Success/Failed), timestamp, target entity, and a generic payload/error preview
- [x] A failed job's detail view shows the error message/response and a Retry action; retry re-queues the job and records a new attempt linked to the original job
- [x] A manual "trigger sync now" action exists for a given sync type, gated to admins with `ERPIntegration:Edit`
- [x] Sync jobs are filterable by type, status, and date range, and searchable by target entity ID
- [x] Dashboard summary counts (queued/failed/succeeded today) are surfaced here and echoed by the Admin Dashboard's ERP Sync Status widget — see Scope Decision for how this stays additive to the existing widget
- [x] The integration layer is built against a generic `SyncJob` / `SyncConnector` interface so a real ERP adapter can be plugged in later without redesigning this console
- [x] Retry attempts are capped with a configurable exponential backoff (max retries, backoff interval) — see Scope Decision for "configurable" meaning code-level constants, not a settings UI
- [x] Every manual trigger and retry action is logged to the audit log via `writeAuditLog`

## Scope Decision

Research before implementation found a related but narrower piece
already shipped by STORY-028: `OrderIntegrationEvent` is a real,
working outbox for order-lifecycle events only
(`order.confirmed`/`cancelled`/`dispatched`/`delivered`), with no
retry concept at all — no attempt count, no backoff, no admin UI. Its
only consumer was the Admin Dashboard's `ErpSyncCard`, fed by
`orderRepository.getErpSyncStatus()`, gated on
`AdminModule.ERPIntegration` (already had this one real consumer —
not a zero-usage enum).

This story does **not** retrofit `OrderIntegrationEvent` into a
generic multi-entity job queue — that table is real, order-specific,
and already relied on by `order.service.ts`'s business flow;
retrofitting it for "Stock Import"/"Product Sync" job types that
don't involve an `Order` row at all would be a risky schema change to
shipped code for no real benefit. Instead this story adds the generic
`SyncJob`/`SyncJobAttempt` models entirely new and independent of
`OrderIntegrationEvent`. The Admin Dashboard's `ErpSyncCard` gets
additively extended to also show this new queue's today's counts
alongside the existing `OrderIntegrationEvent`-based stats — the
existing `pending`/`failed`/`lastProcessedAt` fields and their one
existing assertion in `admin-dashboard-service.test.ts` are untouched,
only new optional fields were added.

"Configurable exponential backoff" is a module-level constant
(`MAX_ATTEMPTS = 5`, `BASE_BACKOFF_MS = 60_000` in
`sync-job.service.ts`), not a new admin-editable setting — nothing in
the AC asks for a settings form for two numbers, and this codebase
has no job-scheduling infrastructure (confirmed precedent:
STORY-050d's "Send due campaigns" is a manual admin trigger, not a
real cron). Retries here are the same shape: a human clicks Retry;
the backoff only gates *when* that click is allowed to actually
re-run.

## Tasks
- [x] **Database:** `SyncJob` (jobType, status, targetEntityType, targetEntityId, payload JSON, errorMessage, attemptCount, nextRetryAt, createdById, createdAt, updatedAt), `SyncJobAttempt` (jobId, attemptNumber, result, errorDetail, startedAt, completedAt) — new, additive, `OrderIntegrationEvent` untouched.
- [x] **API:** `/api/admin/erp-integration/jobs` (GET list/filter, POST trigger), `/jobs/[id]` (GET detail), `/jobs/[id]/retry` (POST), `/summary` (GET, for the dashboard widget) — a top-level module path, not nested under `/api/admin/settings/integrations`, matching the dedicated `AdminModule.ERPIntegration` gate.
- [x] **Service/Backend:** `sync-job.service.ts` (queue read/retry orchestration with backoff) and `sync-connector.ts`'s `SyncConnector` interface (`push(job): Promise<SyncResult>`) with only `stubConnector` for now — explicitly not implementing a named ERP's API in this story. The stub's `payload.forceFailure` hook gives tests/demos a deterministic way to exercise the retry path.
- [x] **Frontend:** `src/app/(admin)/admin/erp-integration/page.tsx` + `admin-erp-integration-view.tsx` — a trigger form, a filter bar (type/status/date-range/target-entity-id), and the jobs table; `sync-job-detail-drawer.tsx` — payload/error viewer, attempt history, and a Retry button (disabled with the reason shown when blocked).
- [x] **Validation:** `src/validation/sync-job.schema.ts` — trigger input and filter schemas; retry rejected once `attemptCount >= MAX_ATTEMPTS` or before `nextRetryAt`, enforced in the service (a request-time check against `Date.now()`, not expressible in a static Zod schema).
- [x] **Testing:** `tests/unit/sync-job-service.test.ts` (trigger success/failure, retry increment, max-attempts rejection, backoff rejection, permission gating, summary counts), one added assertion in `tests/unit/admin-dashboard-service.test.ts`, `tests/e2e/admin-erp-integration.spec.ts` (trigger → fail → retry via the real UI, and a max-attempts-blocked case).
- [x] **Documentation:** this doc, `docs/architecture-decisions.md`, `docs/blueprint.md` Section 9a.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions

**Note:** the specific ERP system to integrate with is an unconfirmed open item per `docs/blueprint.md` Section 10 ("ERP system being integrated with... spec assumes ERP sync exists but doesn't name the system"). This story is intentionally scoped to a generic, connector-agnostic sync-log/retry interface, not a named-ERP integration. Do not guess at a specific ERP's API; confirm with the client before building a real connector — implement it in `sync-connector.ts` via `registerSyncConnector()`.

## Out of Scope
- The actual ERP connector/adapter implementation for a named system
- Bidirectional real-time sync payload construction logic for a specific system (this story covers queue monitoring and retry, not the sync content itself)

## References
- `docs/blueprint.md` Section 7 ("ERP Integration Console" bullet)
- `docs/blueprint.md` Section 10 (ERP system unconfirmed)
