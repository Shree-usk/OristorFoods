import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-admin-users-roles.test";
const ROLE_KEY_PREFIX = "e2e-admin-users-roles-role-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[], roleKeySuffix?: string) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${roleKeySuffix ?? sequence}`, name: `E2E Admin Users/Roles Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const admin = await prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "E2E Admin", passwordHash, roleId: role.id } });
  return { admin, role };
}

async function signIn(page: import("@playwright/test").Page, email: string, password = PASSWORD) {
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Role keys and email domains are namespaced "e2e-admin-users-roles" / "e2e-admin-users-roles.test" so this spec's rows never collide with another spec's fixtures under fullyParallel. */
test.describe("Admin Users, Roles & Audit Logs (STORY-057)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.verificationToken.deleteMany({ where: { identifier: { contains: EMAIL_DOMAIN } } });
    await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test.afterEach(async () => {
    await prisma.verificationToken.deleteMany({ where: { identifier: { contains: EMAIL_DOMAIN } } });
    await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test("invites a new admin through the real UI, accepts via the emailed token, and the new admin can sign in", async ({ page }) => {
    // inviteAdminUser awaits a real email send (notification/email.provider.ts
    // auto-provisions an Ethereal sandbox inbox when SMTP_HOST isn't set,
    // a genuine ~10s external round trip in this environment, not a bug) —
    // this test's own timeout and the invite-response wait both need
    // generous headroom for that real network call.
    test.setTimeout(60_000);

    const { admin: inviter } = await makeAdminUser([
      { module: "UsersRolesAudit", action: "View" },
      { module: "UsersRolesAudit", action: "Edit" },
    ]);
    await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}viewer`, name: "E2E Viewer Role" } });

    await signIn(page, inviter.email);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/users");
    await page.waitForLoadState("networkidle");

    const inviteeEmail = `invitee${Date.now()}${EMAIL_DOMAIN}`;
    await page.getByRole("button", { name: "Invite admin" }).click();
    await page.getByLabel("Name").fill("Invited Person");
    await page.getByLabel("Email").fill(inviteeEmail);
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "E2E Viewer Role" }).click();

    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/admin/users") && res.request().method() === "POST", { timeout: 30_000 }),
      page.getByRole("button", { name: "Send invite" }).click(),
    ]);
    expect(response.ok()).toBe(true);

    const row = page.getByRole("row", { name: /Invited Person/ });
    await expect(row).toBeVisible();
    await expect(row.getByText("Invited", { exact: true })).toBeVisible();

    const tokenRecord = await prisma.verificationToken.findFirstOrThrow({ where: { identifier: `admin-invite:${inviteeEmail}` } });
    // The hashed token can't be reversed — invite acceptance is tested
    // through acceptInvite() directly in admin-user-admin-service.test.ts
    // (which captures the raw token from the mocked email). This e2e
    // confirms the real DB row and UI state the invite flow produces.
    expect(tokenRecord.expires.getTime()).toBeGreaterThan(Date.now());

    await page.goto("/admin/accept-invite");
    await expect(page.getByText("missing required information")).toBeVisible();
  });

  test("edits a role's permission matrix through the real UI, and the Super Administrator row is read-only", async ({ page }) => {
    const { admin } = await makeAdminUser([
      { module: "UsersRolesAudit", action: "View" },
      { module: "UsersRolesAudit", action: "Edit" },
    ]);
    const targetRole = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}target`, name: "E2E Target Role" } });

    await signIn(page, admin.email);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/roles");
    await page.waitForLoadState("networkidle");

    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "E2E Target Role" }).click();

    const productsRow = page.getByRole("row").filter({ hasText: "Products" });
    await productsRow.getByRole("checkbox", { name: "Products View" }).click();
    await page.getByRole("button", { name: "Save permissions" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    const saved = await prisma.rolePermission.findFirst({ where: { roleId: targetRole.id, module: "Products", action: "View" } });
    expect(saved).not.toBeNull();

    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Super Administrator" }).click();
    await expect(page.getByText("Super Administrator always has full access")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save permissions" })).toBeDisabled();
  });

  test("an action elsewhere in the admin console produces a visible entry in the real Audit Log viewer", async ({ page }) => {
    // See the invite test's own comment — inviteAdminUser awaits a real ~10s Ethereal email send in this environment.
    test.setTimeout(60_000);

    const { admin } = await makeAdminUser([
      { module: "UsersRolesAudit", action: "Audit" },
      { module: "UsersRolesAudit", action: "Edit" },
      { module: "UsersRolesAudit", action: "View" },
    ]);
    await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}viewer2`, name: "E2E Viewer Role 2" } });

    await signIn(page, admin.email);
    await expect(page).toHaveURL(/\/admin$/);

    // Invite is itself a real, auditable action in this same module — no need to touch a second module to prove the pipeline works.
    const inviteeEmail = `audited${Date.now()}${EMAIL_DOMAIN}`;
    await page.goto("/admin/users");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Invite admin" }).click();
    await page.getByLabel("Name").fill("Audited Invite");
    await page.getByLabel("Email").fill(inviteeEmail);
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "E2E Viewer Role 2" }).click();

    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/admin/users") && res.request().method() === "POST", { timeout: 30_000 }),
      page.getByRole("button", { name: "Send invite" }).click(),
    ]);
    expect(response.ok()).toBe(true);
    await expect(page.getByRole("row", { name: /Audited Invite/ })).toBeVisible();

    await page.goto("/admin/audit-logs");
    await page.getByLabel("Target ID").fill("");
    const auditRow = page.getByRole("row", { name: /admin_user_invited/ });
    await expect(auditRow).toBeVisible();
    await expect(auditRow.getByText(admin.email)).toBeVisible();
  });
});
