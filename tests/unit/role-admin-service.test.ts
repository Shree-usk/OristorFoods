// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { cloneRole, listRolesWithPermissions, updateRolePermissions } from "@/services/role-admin.service";
import { RoleKeyInUseError } from "@/services/role-admin.errors";
import { SuperAdministratorFloorError } from "@/services/permission.errors";
import { PermissionDeniedError } from "@/services/permission.errors";
import { SUPER_ADMINISTRATOR_ROLE_KEY } from "@/services/permission.service";

const EMAIL_DOMAIN = "@role-admin-svc-test.test";
const ROLE_KEY_PREFIX = "role-admin-svc-test-role-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Role Admin Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

async function makeFullAccessAdmin() {
  return makeAdmin([
    { module: "UsersRolesAudit", action: "View" },
    { module: "UsersRolesAudit", action: "Edit" },
  ]);
}

async function makeTestRole(permissions: { module: AdminModule; action: AdminAction }[] = []) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}target-${sequence}`, name: `Role Admin Svc Test Target ${sequence}` } });
  if (permissions.length > 0) await prisma.rolePermission.createMany({ data: permissions.map((p) => ({ roleId: role.id, ...p })) });
  return role;
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("role-admin.service — updateRolePermissions", () => {
  it("grants and revokes permissions for an ordinary role", async () => {
    const admin = await makeFullAccessAdmin();
    const target = await makeTestRole([{ module: "Products", action: "View" }]);

    const updated = await updateRolePermissions(admin.id, target.id, [
      { module: "Products", action: "View", granted: false },
      { module: "Products", action: "Edit", granted: true },
      { module: "Orders", action: "View", granted: true },
    ]);

    const keys = updated.map((row) => `${row.module}:${row.action}`).sort();
    expect(keys).toEqual(["Orders:View", "Products:Edit"]);
  });

  it("rejects reducing the Super Administrator role below full access", async () => {
    const admin = await makeFullAccessAdmin();
    const existing = await prisma.role.findUnique({ where: { key: SUPER_ADMINISTRATOR_ROLE_KEY } });
    const superRole = existing ?? (await prisma.role.create({ data: { key: SUPER_ADMINISTRATOR_ROLE_KEY, name: "Super Administrator" } }));
    await prisma.rolePermission.deleteMany({ where: { roleId: superRole.id } });
    await prisma.rolePermission.createMany({ data: [{ roleId: superRole.id, module: "Products", action: "View" }] });

    await expect(updateRolePermissions(admin.id, superRole.id, [{ module: "Products", action: "View", granted: false }])).rejects.toBeInstanceOf(SuperAdministratorFloorError);

    // Nothing should have been written — the matrix save is all-or-nothing.
    const stillThere = await prisma.rolePermission.findMany({ where: { roleId: superRole.id } });
    expect(stillThere).toHaveLength(1);
  });

  it("allows granting additional permissions to the Super Administrator role", async () => {
    const admin = await makeFullAccessAdmin();
    const existing = await prisma.role.findUnique({ where: { key: SUPER_ADMINISTRATOR_ROLE_KEY } });
    const superRole = existing ?? (await prisma.role.create({ data: { key: SUPER_ADMINISTRATOR_ROLE_KEY, name: "Super Administrator" } }));
    await prisma.rolePermission.deleteMany({ where: { roleId: superRole.id } });
    await prisma.rolePermission.createMany({ data: [{ roleId: superRole.id, module: "Products", action: "View" }] });

    const updated = await updateRolePermissions(admin.id, superRole.id, [
      { module: "Products", action: "View", granted: true },
      { module: "Products", action: "Edit", granted: true },
    ]);
    expect(updated).toHaveLength(2);
  });

  it("rejects a View-only admin's matrix save but allows the list read", async () => {
    const viewer = await makeAdmin([{ module: "UsersRolesAudit", action: "View" }]);
    const target = await makeTestRole();
    await expect(listRolesWithPermissions(viewer.id)).resolves.toBeInstanceOf(Array);
    await expect(updateRolePermissions(viewer.id, target.id, [{ module: "Products", action: "View", granted: true }])).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("role-admin.service — cloneRole", () => {
  it("copies the source role's exact permission set onto a new role", async () => {
    const admin = await makeFullAccessAdmin();
    const source = await makeTestRole([
      { module: "Products", action: "View" },
      { module: "Products", action: "Edit" },
      { module: "Orders", action: "View" },
    ]);

    const newKey = `${ROLE_KEY_PREFIX}cloned-${Date.now()}`;
    const cloned = await cloneRole(admin.id, { sourceRoleId: source.id, newKey, newName: "Cloned Role" });

    const clonedPermissions = await prisma.rolePermission.findMany({ where: { roleId: cloned.id } });
    expect(clonedPermissions.map((p) => `${p.module}:${p.action}`).sort()).toEqual(["Orders:View", "Products:Edit", "Products:View"]);
  });

  it("rejects a duplicate role key", async () => {
    const admin = await makeFullAccessAdmin();
    const source = await makeTestRole();
    const existingTarget = await makeTestRole();

    await expect(cloneRole(admin.id, { sourceRoleId: source.id, newKey: existingTarget.key, newName: "Dup" })).rejects.toBeInstanceOf(RoleKeyInUseError);
  });
});
