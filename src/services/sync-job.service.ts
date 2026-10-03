import type { Prisma } from "@/generated/prisma/client";
import * as syncJobRepository from "@/repositories/sync-job.repository";
import type { SyncJobFilters } from "@/repositories/sync-job.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { requirePermission } from "@/services/permission.service";
import { getSyncConnector } from "@/services/sync-connector";
import { SyncJobMaxAttemptsExceededError, SyncJobNotFoundError, SyncJobRetryNotYetAllowedError } from "@/services/sync-job.errors";

/**
 * STORY-056. Admin-facing sync queue — permission-gated (ERPIntegration,
 * View/Edit) and audit-logged. "Retry" is always admin-initiated (no job
 * scheduler exists in this codebase); the backoff only gates WHEN that
 * click is allowed to actually re-run, not an automatic re-attempt.
 */

export const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 60_000;

function backoffDelayMs(attemptCount: number): number {
  return BASE_BACKOFF_MS * 2 ** attemptCount;
}

export async function listJobsForAdmin(adminUserId: string, filters: SyncJobFilters) {
  await requirePermission(adminUserId, "ERPIntegration", "View");
  return syncJobRepository.listJobs(filters);
}

async function requireJob(id: string) {
  const job = await syncJobRepository.findJobById(id);
  if (!job) throw new SyncJobNotFoundError();
  return job;
}

export async function getJobDetail(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "ERPIntegration", "View");
  return requireJob(id);
}

export interface TriggerSyncInput {
  jobType: string;
  targetEntityType?: string | null;
  targetEntityId?: string | null;
  payload?: Record<string, unknown> | null;
}

export async function triggerSync(adminUserId: string, input: TriggerSyncInput) {
  await requirePermission(adminUserId, "ERPIntegration", "Edit");

  const job = await syncJobRepository.createJob({
    jobType: input.jobType,
    targetEntityType: input.targetEntityType ?? null,
    targetEntityId: input.targetEntityId ?? null,
    payload: (input.payload as Prisma.InputJsonValue | null) ?? null,
    createdById: adminUserId,
  });

  const result = await getSyncConnector().push({
    id: job.id,
    jobType: job.jobType,
    targetEntityType: job.targetEntityType,
    targetEntityId: job.targetEntityId,
    payload: input.payload ?? null,
  });

  await syncJobRepository.createAttempt({
    jobId: job.id,
    attemptNumber: 1,
    result: result.success ? "Success" : "Failed",
    errorDetail: result.errorMessage ?? null,
    completedAt: new Date(),
  });

  const updated = await syncJobRepository.updateJobStatus(job.id, {
    status: result.success ? "Success" : "Failed",
    errorMessage: result.errorMessage ?? null,
    attemptCount: 1,
    nextRetryAt: result.success ? null : new Date(Date.now() + backoffDelayMs(1)),
  });

  await writeAuditLog({ actorId: adminUserId, action: "sync_job_triggered", module: "ERPIntegration", targetType: "SyncJob", targetId: job.id });
  return updated;
}

export async function retryJob(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "ERPIntegration", "Edit");
  const job = await requireJob(id);

  if (job.attemptCount >= MAX_ATTEMPTS) throw new SyncJobMaxAttemptsExceededError(MAX_ATTEMPTS);
  if (job.nextRetryAt && job.nextRetryAt.getTime() > Date.now()) throw new SyncJobRetryNotYetAllowedError(job.nextRetryAt);

  const attemptNumber = job.attemptCount + 1;
  const payload = (job.payload as Record<string, unknown> | null) ?? null;

  const result = await getSyncConnector().push({
    id: job.id,
    jobType: job.jobType,
    targetEntityType: job.targetEntityType,
    targetEntityId: job.targetEntityId,
    payload,
  });

  await syncJobRepository.createAttempt({
    jobId: job.id,
    attemptNumber,
    result: result.success ? "Success" : "Failed",
    errorDetail: result.errorMessage ?? null,
    completedAt: new Date(),
  });

  const updated = await syncJobRepository.updateJobStatus(job.id, {
    status: result.success ? "Success" : "Failed",
    errorMessage: result.errorMessage ?? null,
    attemptCount: attemptNumber,
    nextRetryAt: result.success ? null : new Date(Date.now() + backoffDelayMs(attemptNumber)),
  });

  await writeAuditLog({ actorId: adminUserId, action: "sync_job_retried", module: "ERPIntegration", targetType: "SyncJob", targetId: job.id });
  return updated;
}

export async function getTodaySummary(adminUserId: string) {
  await requirePermission(adminUserId, "ERPIntegration", "View");
  return syncJobRepository.getTodaySummary();
}
