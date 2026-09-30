// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  SUPER_ADMINISTRATOR_ROLE_KEY,
  assertCanModifyRolePermission,
  assertNotLastSuperAdmin,
  hasPermission,
  requirePermission,
} from "@/services/permission.service";
import { LastSuperAdministratorError, PermissionDeniedError, SuperAdministratorFloorError } from "@/services/permission.errors";

const KEY_PREFIX = "perm-svc-test-";
const EMAIL_DOMAIN = "@perm-svc-test.test";
let sequence = 0;

async function makeRole(overrides: { key?: string; name?: string } = {}) {
  sequence += 1;
  return prisma.role.create({
    data: { key: overrides.key ?? `${KEY_PREFIX}${sequence}`, name: overrides.name ?? `Perm Svc Test Role ${sequence}` },
  });
}

async function makeAdminUser(roleId: string) {
  sequence += 1;
  return prisma.adminUser.create({
    data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId },
  });
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: KEY_PREFIX } } });
  // Only removes a role THIS test file created (marked by the "Test" name
  // suffix) — never a real seeded "Super Administrator" row, which has no
  // such suffix. See findOrCreateSuperAdministratorRole below.
  await prisma.role.deleteMany({ where: { key: SUPER_ADMINISTRATOR_ROLE_KEY, name: "Super Administrator Test" } });
});

describe("permission.service", () => {
  describe("hasPermission / requirePermission", () => {
    it("grants exactly the module+action combinations a role has rows for", async () => {
      const role = await makeRole();
      await prisma.rolePermission.create({ data: { roleId: role.id, module: "Products", action: "Edit" } });
      const admin = await makeAdminUser(role.id);

      await expect(hasPermission(admin.id, "Products", "Edit")).resolves.toBe(true);
      await expect(hasPermission(admin.id, "Products", "Delete")).resolves.toBe(false);
      await expect(hasPermission(admin.id, "Orders", "Edit")).resolves.toBe(false);
    });

    it("returns false for a nonexistent admin user rather than throwing", async () => {
      await expect(hasPermission("nonexistent-id", "Products", "View")).resolves.toBe(false);
    });

    it("requirePermission resolves silently when granted", async () => {
      const role = await makeRole();
      await prisma.rolePermission.create({ data: { roleId: role.id, module: "Orders", action: "View" } });
      const admin = await makeAdminUser(role.id);

      await expect(requirePermission(admin.id, "Orders", "View")).resolves.toBeUndefined();
    });

    it("requirePermission throws PermissionDeniedError and writes an audit-log entry when denied", async () => {
      const role = await makeRole();
      const admin = await makeAdminUser(role.id);

      await expect(requirePermission(admin.id, "Orders", "Delete")).rejects.toBeInstanceOf(PermissionDeniedError);

      const entry = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "permission_denied" } });
      expect(entry).not.toBeNull();
      expect(entry?.module).toBe("Orders");
    });
  });

  describe("assertCanModifyRolePermission (pure)", () => {
    it("blocks removing a grant from the Super Administrator role", () => {
      expect(() => assertCanModifyRolePermission(SUPER_ADMINISTRATOR_ROLE_KEY, false)).toThrow(SuperAdministratorFloorError);
    });

    it("allows granting (adding) a permission to the Super Administrator role", () => {
      expect(() => assertCanModifyRolePermission(SUPER_ADMINISTRATOR_ROLE_KEY, true)).not.toThrow();
    });

    it("allows reducing any other role's permissions", () => {
      expect(() => assertCanModifyRolePermission("administrator", false)).not.toThrow();
    });
  });

  describe("assertNotLastSuperAdmin", () => {
    it("is a no-op for an admin who does not hold the Super Administrator role", async () => {
      const role = await makeRole();
      const admin = await makeAdminUser(role.id);
      await expect(assertNotLastSuperAdmin(admin.id)).resolves.toBeUndefined();
    });

    // The guard's "is this the Super Administrator role" check is a hardcoded
    // comparison against SUPER_ADMINISTRATOR_ROLE_KEY, so exercising it
    // means using that exact key — findOrCreate rather than always
    // creating, so this never collides with a real seeded row (unique
    // constraint on Role.key), and any pre-existing AdminUsers under that
    // role are cleared first so the count this guard checks is exact and
    // deterministic. Safe in a local/CI test database only.
    async function findOrCreateSuperAdministratorRole() {
      const existing = await prisma.role.findUnique({ where: { key: SUPER_ADMINISTRATOR_ROLE_KEY } });
      if (existing) {
        await prisma.adminUser.deleteMany({ where: { roleId: existing.id } });
        return existing;
      }
      return prisma.role.create({ data: { key: SUPER_ADMINISTRATOR_ROLE_KEY, name: "Super Administrator Test" } });
    }

    it("throws when the admin is the last active Super Administrator", async () => {
      const role = await findOrCreateSuperAdministratorRole();
      const admin = await makeAdminUser(role.id);
      await expect(assertNotLastSuperAdmin(admin.id)).rejects.toBeInstanceOf(LastSuperAdministratorError);
    });

    it("does not throw when another active Super Administrator also exists", async () => {
      const role = await findOrCreateSuperAdministratorRole();
      const admin = await makeAdminUser(role.id);
      await makeAdminUser(role.id);
      await expect(assertNotLastSuperAdmin(admin.id)).resolves.toBeUndefined();
    });
  });
});
