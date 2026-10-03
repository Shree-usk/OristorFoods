import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-admin-erp-integration.test";
const ROLE_KEY_PREFIX = "e2e-admin-erp-integration-role-";
const JOB_TYPE_PREFIX = "E2E ERP ";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin ERP Integration Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "E2E Admin", passwordHash, roleId: role.id } });
}

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Job types are namespaced "E2E ERP ..." so this spec's SyncJob rows never collide with another spec's fixtures under fullyParallel. */
test.describe("Admin ERP Integration Console (STORY-056)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.syncJobAttempt.deleteMany({ where: { job: { jobType: { startsWith: JOB_TYPE_PREFIX } } } });
    await prisma.syncJob.deleteMany({ where: { jobType: { startsWith: JOB_TYPE_PREFIX } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test.afterEach(async () => {
    await prisma.syncJobAttempt.deleteMany({ where: { job: { jobType: { startsWith: JOB_TYPE_PREFIX } } } });
    await prisma.syncJob.deleteMany({ where: { jobType: { startsWith: JOB_TYPE_PREFIX } } });
  });

  test("triggers a sync that fails, retries it from the detail drawer, and the attempt count/status update in the real UI", async ({ page }) => {
    const admin = await makeAdminUser([
      { module: "ERPIntegration", action: "View" },
      { module: "ERPIntegration", action: "Edit" },
    ]);

    await signIn(page, admin.email);
    await page.goto("/admin/erp-integration");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder("Order Export").fill(`${JOB_TYPE_PREFIX}Order Export`);
    await page.getByRole("button", { name: "Trigger sync now" }).click();

    const row = page.getByRole("row", { name: new RegExp(`${JOB_TYPE_PREFIX}Order Export`) });
    await expect(row).toBeVisible();
    await expect(row.getByText("Success")).toBeVisible();

    await row.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();

    // The trigger form has no raw-payload field (not a real admin need) —
    // the stub connector's forceFailure hook is exercised via the real API
    // route directly instead, same production code path as the UI form.
    const triggerResponse = await page.request.post("/api/admin/erp-integration/jobs", {
      data: { jobType: `${JOB_TYPE_PREFIX}Stock Import`, payload: { forceFailure: true } },
    });
    expect(triggerResponse.ok()).toBe(true);

    await page.reload();
    const failedRow = page.getByRole("row", { name: new RegExp(`${JOB_TYPE_PREFIX}Stock Import`) });
    await expect(failedRow).toBeVisible();
    await expect(failedRow.getByText("Failed")).toBeVisible();

    await failedRow.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Forced failure").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeDisabled();
    await expect(page.getByText(/Retry available after/)).toBeVisible();

    // Clear the backoff window directly so the retry can actually run within the test.
    const job = await prisma.syncJob.findFirstOrThrow({ where: { jobType: `${JOB_TYPE_PREFIX}Stock Import` } });
    await prisma.syncJob.update({ where: { id: job.id }, data: { nextRetryAt: new Date(Date.now() - 1000) } });

    await page.reload();
    await failedRow.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeEnabled();
    await page.getByRole("button", { name: "Retry" }).click();

    await expect(page.getByText("2 attempt(s)")).toBeVisible();
  });

  test("blocks a retry once the job has reached its maximum attempts", async ({ page }) => {
    const admin = await makeAdminUser([
      { module: "ERPIntegration", action: "View" },
      { module: "ERPIntegration", action: "Edit" },
    ]);
    const job = await prisma.syncJob.create({
      data: { jobType: `${JOB_TYPE_PREFIX}Max Attempts`, status: "Failed", attemptCount: 5, errorMessage: "Simulated failure.", createdById: admin.id },
    });

    await signIn(page, admin.email);
    await page.goto("/admin/erp-integration");
    await page.waitForLoadState("networkidle");

    const row = page.getByRole("row", { name: new RegExp(`${JOB_TYPE_PREFIX}Max Attempts`) });
    await row.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeDisabled();
    await expect(page.getByText("Maximum retry attempts reached.")).toBeVisible();

    await prisma.syncJob.delete({ where: { id: job.id } });
  });
});
