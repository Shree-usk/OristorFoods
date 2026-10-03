// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { MAX_ATTEMPTS, getJobDetail, getTodaySummary, listJobsForAdmin, retryJob, triggerSync } from "@/services/sync-job.service";
import { SyncJobMaxAttemptsExceededError, SyncJobRetryNotYetAllowedError } from "@/services/sync-job.errors";
import { PermissionDeniedError } from "@/services/permission.errors";

const EMAIL_DOMAIN = "@sync-job-svc-test.test";
const ROLE_KEY_PREFIX = "sync-job-svc-test-role-";
const JOB_TYPE_PREFIX = "SyncJobSvcTest ";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Sync Job Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

async function makeFullAccessAdmin() {
  return makeAdmin([
    { module: "ERPIntegration", action: "View" },
    { module: "ERPIntegration", action: "Edit" },
  ]);
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.syncJobAttempt.deleteMany({ where: { job: { jobType: { startsWith: JOB_TYPE_PREFIX } } } });
  await prisma.syncJob.deleteMany({ where: { jobType: { startsWith: JOB_TYPE_PREFIX } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("sync-job.service — triggerSync", () => {
  it("creates a Success job with one recorded attempt when the stub connector succeeds", async () => {
    const admin = await makeFullAccessAdmin();
    const job = await triggerSync(admin.id, { jobType: `${JOB_TYPE_PREFIX}Order Export` });

    expect(job.status).toBe("Success");
    expect(job.attemptCount).toBe(1);
    expect(job.nextRetryAt).toBeNull();

    const detail = await getJobDetail(admin.id, job.id);
    expect(detail.attempts).toHaveLength(1);
    expect(detail.attempts[0]?.result).toBe("Success");

    const logCount = await prisma.auditLog.count({ where: { actorId: admin.id, action: "sync_job_triggered", targetId: job.id } });
    expect(logCount).toBe(1);
  });

  it("creates a Failed job with a future nextRetryAt when payload.forceFailure is set", async () => {
    const admin = await makeFullAccessAdmin();
    const job = await triggerSync(admin.id, { jobType: `${JOB_TYPE_PREFIX}Stock Import`, payload: { forceFailure: true } });

    expect(job.status).toBe("Failed");
    expect(job.errorMessage).toContain("Forced failure");
    expect(job.nextRetryAt).not.toBeNull();
    expect(job.nextRetryAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects a View-only admin's trigger but allows the list read", async () => {
    const viewer = await makeAdmin([{ module: "ERPIntegration", action: "View" }]);
    await expect(listJobsForAdmin(viewer.id, {})).resolves.toBeInstanceOf(Array);
    await expect(triggerSync(viewer.id, { jobType: `${JOB_TYPE_PREFIX}Product Sync` })).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("sync-job.service — retryJob", () => {
  it("retries a failed job, incrementing attemptCount and recording a new attempt", async () => {
    const admin = await makeFullAccessAdmin();
    const job = await triggerSync(admin.id, { jobType: `${JOB_TYPE_PREFIX}Retry Happy Path`, payload: { forceFailure: true } });
    // Bypass the just-set backoff window directly for this test's purposes.
    await prisma.syncJob.update({ where: { id: job.id }, data: { nextRetryAt: new Date(Date.now() - 1000) } });

    const retried = await retryJob(admin.id, job.id);
    expect(retried.attemptCount).toBe(2);
    expect(retried.status).toBe("Failed");

    const detail = await getJobDetail(admin.id, job.id);
    expect(detail.attempts).toHaveLength(2);
    expect(detail.attempts.map((a) => a.attemptNumber).sort()).toEqual([1, 2]);

    const logCount = await prisma.auditLog.count({ where: { actorId: admin.id, action: "sync_job_retried", targetId: job.id } });
    expect(logCount).toBe(1);
  });

  it("a retry that succeeds clears nextRetryAt and flips status to Success", async () => {
    const admin = await makeFullAccessAdmin();
    const job = await triggerSync(admin.id, { jobType: `${JOB_TYPE_PREFIX}Retry Recovers`, payload: { forceFailure: true } });
    // The stub re-reads the job's persisted payload on every push — clearing
    // forceFailure here simulates the upstream issue being resolved before retry.
    await prisma.syncJob.update({ where: { id: job.id }, data: { payload: {}, nextRetryAt: new Date(Date.now() - 1000) } });

    const retried = await retryJob(admin.id, job.id);
    expect(retried.status).toBe("Success");
    expect(retried.nextRetryAt).toBeNull();
  });

  it("rejects a retry once attemptCount has reached the maximum", async () => {
    const admin = await makeFullAccessAdmin();
    const job = await triggerSync(admin.id, { jobType: `${JOB_TYPE_PREFIX}Max Attempts` });
    await prisma.syncJob.update({ where: { id: job.id }, data: { status: "Failed", attemptCount: MAX_ATTEMPTS, nextRetryAt: new Date(Date.now() - 1000) } });

    await expect(retryJob(admin.id, job.id)).rejects.toBeInstanceOf(SyncJobMaxAttemptsExceededError);
  });

  it("rejects a retry attempted before the backoff window has elapsed", async () => {
    const admin = await makeFullAccessAdmin();
    const job = await triggerSync(admin.id, { jobType: `${JOB_TYPE_PREFIX}Backoff`, payload: { forceFailure: true } });

    await expect(retryJob(admin.id, job.id)).rejects.toBeInstanceOf(SyncJobRetryNotYetAllowedError);
  });
});

describe("sync-job.service — getTodaySummary", () => {
  it("reflects queued, failed, and succeeded-today counts from real jobs", async () => {
    const admin = await makeFullAccessAdmin();
    await triggerSync(admin.id, { jobType: `${JOB_TYPE_PREFIX}Summary Success` });
    await triggerSync(admin.id, { jobType: `${JOB_TYPE_PREFIX}Summary Failed`, payload: { forceFailure: true } });

    const summary = await getTodaySummary(admin.id);
    expect(summary.failed).toBeGreaterThanOrEqual(1);
    expect(summary.succeededToday).toBeGreaterThanOrEqual(1);
  });
});
