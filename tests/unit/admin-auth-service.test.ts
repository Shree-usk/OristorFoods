// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import { AccountLockedError } from "@/services/admin-auth.errors";
import { getAdminPasswordVersion, verifyAdminCredentials } from "@/services/admin-auth.service";

const EMAIL_DOMAIN = "@admin-auth-svc-test.test";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeRole() {
  sequence += 1;
  return prisma.role.create({ data: { key: `admin-auth-svc-test-role-${sequence}`, name: `Admin Auth Svc Test Role ${sequence}` } });
}

async function makeAdminUser(overrides: { status?: "Active" | "Locked" | "Deactivated"; lockedUntil?: Date | null; failedLoginAttempts?: number } = {}) {
  sequence += 1;
  const role = await makeRole();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.adminUser.create({
    data: {
      email: `admin-${sequence}${EMAIL_DOMAIN}`,
      name: "Test Admin",
      passwordHash,
      roleId: role.id,
      status: overrides.status ?? "Active",
      lockedUntil: overrides.lockedUntil,
      failedLoginAttempts: overrides.failedLoginAttempts ?? 0,
    },
  });
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: "admin-auth-svc-test-role-" } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: "admin-auth-svc-test-role-" } } });
});

describe("admin-auth.service", () => {
  describe("verifyAdminCredentials", () => {
    it("returns the admin user on correct credentials, resets failed attempts, and logs the success", async () => {
      const admin = await makeAdminUser({ failedLoginAttempts: 2 });

      const result = await verifyAdminCredentials(admin.email, PASSWORD);
      expect(result?.id).toBe(admin.id);

      const refreshed = await prisma.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
      expect(refreshed.failedLoginAttempts).toBe(0);

      const entry = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "login_succeeded" } });
      expect(entry).not.toBeNull();
    });

    it("returns null for a wrong password and increments failedLoginAttempts", async () => {
      const admin = await makeAdminUser();

      const result = await verifyAdminCredentials(admin.email, "wrong-password");
      expect(result).toBeNull();

      const refreshed = await prisma.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
      expect(refreshed.failedLoginAttempts).toBe(1);
    });

    it("returns null for a nonexistent email (no enumeration)", async () => {
      await expect(verifyAdminCredentials(`nobody${EMAIL_DOMAIN}`, PASSWORD)).resolves.toBeNull();
    });

    it("returns null for a non-Active account", async () => {
      const admin = await makeAdminUser({ status: "Deactivated" });
      await expect(verifyAdminCredentials(admin.email, PASSWORD)).resolves.toBeNull();
    });

    it("locks the account after the 5th failed attempt, throwing immediately rather than looking like a plain wrong password, and writes an account_locked audit entry", async () => {
      const admin = await makeAdminUser({ failedLoginAttempts: 4 });

      await expect(verifyAdminCredentials(admin.email, "wrong-password")).rejects.toBeInstanceOf(AccountLockedError);

      const refreshed = await prisma.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
      expect(refreshed.lockedUntil).not.toBeNull();
      expect(refreshed.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

      const entry = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "account_locked" } });
      expect(entry).not.toBeNull();
    });

    it("throws AccountLockedError for an account still within its lockout window, even with the correct password", async () => {
      const admin = await makeAdminUser({ lockedUntil: new Date(Date.now() + 10 * 60 * 1000) });
      await expect(verifyAdminCredentials(admin.email, PASSWORD)).rejects.toBeInstanceOf(AccountLockedError);
    });

    it("allows sign-in again once lockedUntil is in the past", async () => {
      const admin = await makeAdminUser({ lockedUntil: new Date(Date.now() - 1000), failedLoginAttempts: 5 });
      const result = await verifyAdminCredentials(admin.email, PASSWORD);
      expect(result?.id).toBe(admin.id);
    });
  });

  describe("getAdminPasswordVersion", () => {
    it("matches the admin's current passwordChangedAt timestamp", async () => {
      const admin = await makeAdminUser();
      await expect(getAdminPasswordVersion(admin.id)).resolves.toBe(admin.passwordChangedAt.getTime());
    });

    it("returns 0 for a nonexistent admin", async () => {
      await expect(getAdminPasswordVersion("nonexistent-id")).resolves.toBe(0);
    });
  });
});
