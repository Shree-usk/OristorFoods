# STORY-056: ERP Integration Console

**Status:** Draft
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Super Administrator, Warehouse Manager, Finance Manager, Production Manager

## User Story
As a Warehouse Manager, I want to monitor the ERP sync queue and retry failed jobs, so that inventory and order data stays consistent between ODEP and the back-office ERP without waiting on engineering.
As a Super Administrator, I want to manually trigger a sync for a given data type, so that I can force a refresh when I know upstream data has changed.

## Description
This story delivers the ERP Integration Console module from `docs/blueprint.md` Section 7: "sync queue monitoring, failed job retry." Per Section 10, the specific ERP system being integrated with is an unconfirmed open item — "the spec assumes ERP sync exists but doesn't name the system." This story is deliberately scoped to a generic, provider-agnostic sync-log/retry interface (queue, job status, retry, error detail) rather than building against any named ERP's API. The actual connector/adapter for a specific ERP is explicitly out of scope until the system is confirmed with the client.

## Acceptance Criteria
- [ ] A sync queue view lists sync jobs (type, e.g. Order Export / Stock Import / Product Sync), status (Queued/Processing/Success/Failed), timestamp, target entity, and a generic payload/error preview
- [ ] A failed job's detail view shows the error message/response and a Retry action; retry re-queues the job and records a new attempt linked to the original job
- [ ] A manual "trigger sync now" action exists for a given sync type, gated to Super Administrator/Administrator by default via STORY-038 permissions
- [ ] Sync jobs are filterable by type, status, and date range, and searchable by target entity ID
- [ ] Dashboard summary counts (queued/failed/succeeded today) are surfaced here and echoed by the Admin Dashboard's (STORY-039) ERP Sync Status widget
- [ ] The integration layer is built against a generic `SyncJob` / `SyncConnector` interface so a real ERP adapter can be plugged in later without redesigning this console
- [ ] Retry attempts are capped with a configurable exponential backoff (max retries, backoff interval)
- [ ] Every manual trigger and retry action is logged to the audit log (STORY-057)

## Tasks
- [ ] **Database:** `SyncJob` (jobType, status, targetEntityType, targetEntityId, payload JSON, errorMessage, attemptCount, createdAt, updatedAt), `SyncJobAttempt` (jobId, attemptNumber, result, errorDetail, startedAt, completedAt).
- [ ] **API:** `/api/admin/integrations/erp/jobs` (list/filter), `/api/admin/integrations/erp/jobs/[id]`, `/api/admin/integrations/erp/jobs/[id]/retry`, `/api/admin/integrations/erp/trigger`.
- [ ] **Service/Backend:** `sync-job.service.ts` (generic queue read/retry orchestration with backoff) and a `SyncConnector` interface (`push(job): Promise<SyncResult>`) with only a no-op/stub implementation for now — explicitly not implementing a named ERP's API in this story.
- [ ] **Frontend:** `src/app/(admin)/settings/integrations/erp/page.tsx` — queue table, job detail drawer with error/payload viewer and a Retry button, and a manual trigger dropdown.
- [ ] **Validation:** Zod schema for the manual trigger payload; retry action rejected once a job exceeds its configured max attempt count.
- [ ] **Testing:** Unit tests for retry/backoff logic and the stub `SyncConnector` contract (so a future real adapter has a conformance test to satisfy); e2e test simulating a failed job, retrying it via the console, and confirming the attempt count increments.
- [ ] **Documentation:** Explicitly document that no real ERP system is integrated yet (blueprint Section 10 open item) — this story delivers the generic monitoring/retry shell and the `SyncConnector` interface a future story will implement against the confirmed ERP.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions

**Note:** the specific ERP system to integrate with is an unconfirmed open item per `docs/blueprint.md` Section 10 ("ERP system being integrated with... spec assumes ERP sync exists but doesn't name the system"). This story is intentionally scoped to a generic, connector-agnostic sync-log/retry interface, not a named-ERP integration. Do not guess at a specific ERP's API; confirm with the client before building a real connector.

## Out of Scope
- The actual ERP connector/adapter implementation for a named system
- Bidirectional real-time sync payload construction logic for a specific system (this story covers queue monitoring and retry, not the sync content itself)

## References
- `docs/blueprint.md` Section 7 ("ERP Integration Console" bullet)
- `docs/blueprint.md` Section 10 (ERP system unconfirmed)
