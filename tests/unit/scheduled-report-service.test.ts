// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { PermissionDeniedError } from "@/services/permission.errors";
import {
  createScheduledReport,
  deleteScheduledReport,
  listScheduledReports,
  processDueScheduledReports,
  updateScheduledReport,
} from "@/services/scheduled-report.service";
import { ScheduledReportNotFoundError } from "@/services/scheduled-report.errors";

const EMAIL_DOMAIN = "@scheduled-report-svc-test.test";
const ROLE_KEY_PREFIX = "scheduled-report-svc-test-role-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Scheduled Report Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

function makeFullAccessAdmin() {
  return makeAdmin([
    { module: "CRMAnalytics", action: "View" },
    { module: "CRMAnalytics", action: "Edit" },
    { module: "CRMAnalytics", action: "Delete" },
    { module: "CRMAnalytics", action: "Approve" },
  ]);
}

function makeEditOnlyAdmin() {
  return makeAdmin([
    { module: "CRMAnalytics", action: "View" },
    { module: "CRMAnalytics", action: "Edit" },
  ]);
}

afterEach(async () => {
  await prisma.scheduledReport.deleteMany({ where: { createdBy: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("scheduled-report.service — CRUD", () => {
  it("creates, lists, updates, and deletes a scheduled report, audit-logging each mutation", async () => {
    const admin = await makeFullAccessAdmin();

    const created = await createScheduledReport(admin.id, { reportType: "funnel", recipients: ["finance@oristor.test"], frequency: "Weekly" });
    expect(created.reportType).toBe("funnel");
    expect(created.recipients).toEqual(["finance@oristor.test"]);
    expect(created.lastSentAt).toBeNull();
    expect(await prisma.auditLog.findFirst({ where: { action: "scheduled_report_created", targetId: created.id } })).not.toBeNull();

    const listed = await listScheduledReports(admin.id);
    expect(listed.map((r) => r.id)).toContain(created.id);

    const updated = await updateScheduledReport(admin.id, created.id, { frequency: "Monthly" });
    expect(updated.frequency).toBe("Monthly");
    expect(await prisma.auditLog.findFirst({ where: { action: "scheduled_report_updated", targetId: created.id } })).not.toBeNull();

    await deleteScheduledReport(admin.id, created.id);
    expect(await prisma.scheduledReport.findUnique({ where: { id: created.id } })).toBeNull();
    expect(await prisma.auditLog.findFirst({ where: { action: "scheduled_report_deleted", targetId: created.id } })).not.toBeNull();
  });

  it("throws ScheduledReportNotFoundError for an unknown id", async () => {
    const admin = await makeFullAccessAdmin();
    await expect(updateScheduledReport(admin.id, "nonexistent-id", { frequency: "Monthly" })).rejects.toBeInstanceOf(ScheduledReportNotFoundError);
  });

  it("requires Edit to create", async () => {
    const viewOnly = await makeAdmin([{ module: "CRMAnalytics", action: "View" }]);
    await expect(createScheduledReport(viewOnly.id, { reportType: "funnel", recipients: ["a@test.com"], frequency: "Weekly" })).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("scheduled-report.service — processDueScheduledReports", () => {
  it(
    "sends due reports, stamps lastSentAt, and leaves not-yet-due reports untouched",
    async () => {
      const admin = await makeFullAccessAdmin();
      const neverSent = await createScheduledReport(admin.id, { reportType: "funnel", recipients: ["finance@oristor.test"], frequency: "Weekly" });
      const recentlySent = await createScheduledReport(admin.id, { reportType: "funnel", recipients: ["finance@oristor.test"], frequency: "Weekly" });
      await prisma.scheduledReport.update({ where: { id: recentlySent.id }, data: { lastSentAt: new Date() } });
      const overdueSent = await createScheduledReport(admin.id, { reportType: "funnel", recipients: ["finance@oristor.test"], frequency: "Weekly" });
      await prisma.scheduledReport.update({ where: { id: overdueSent.id }, data: { lastSentAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) } });

      const result = await processDueScheduledReports(admin.id);

      const sentIds = result.results.map((r) => r.reportId);
      expect(sentIds).toContain(neverSent.id);
      expect(sentIds).toContain(overdueSent.id);
      expect(sentIds).not.toContain(recentlySent.id);

      expect((await prisma.scheduledReport.findUnique({ where: { id: neverSent.id } }))?.lastSentAt).not.toBeNull();
      expect((await prisma.scheduledReport.findUnique({ where: { id: recentlySent.id } }))?.lastSentAt?.getTime()).toBeLessThan(Date.now());
      expect(await prisma.auditLog.findFirst({ where: { action: "scheduled_reports_processed_due" } })).not.toBeNull();
    },
    40_000,
  );

  it("requires Approve, not just Edit", async () => {
    const editOnly = await makeEditOnlyAdmin();
    await expect(processDueScheduledReports(editOnly.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
