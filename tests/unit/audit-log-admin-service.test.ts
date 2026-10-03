// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { exportAuditLogsCsv, listAuditLogs } from "@/services/audit-log-admin.service";
import { PermissionDeniedError } from "@/services/permission.errors";

const EMAIL_DOMAIN = "@audit-log-admin-svc-test.test";
const ROLE_KEY_PREFIX = "audit-log-admin-svc-test-role-";
const ACTION_PREFIX = "audit_log_admin_svc_test_";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Audit Log Admin Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { OR: [{ actor: { email: { endsWith: EMAIL_DOMAIN } } }, { action: { startsWith: ACTION_PREFIX } }] } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("audit-log-admin.service — listAuditLogs", () => {
  it("filters by module, action, and target ID", async () => {
    const admin = await makeAdmin([{ module: "UsersRolesAudit", action: "Audit" }]);
    await prisma.auditLog.create({ data: { actorId: admin.id, action: `${ACTION_PREFIX}alpha`, module: "Products", targetType: "Product", targetId: "prod-1" } });
    await prisma.auditLog.create({ data: { actorId: admin.id, action: `${ACTION_PREFIX}beta`, module: "Orders", targetType: "Order", targetId: "order-1" } });

    const byModule = await listAuditLogs(admin.id, { module: "Products" }, 1);
    expect(byModule.rows.every((row) => row.module === "Products")).toBe(true);
    expect(byModule.rows.some((row) => row.action === `${ACTION_PREFIX}alpha`)).toBe(true);

    const byAction = await listAuditLogs(admin.id, { action: `${ACTION_PREFIX}beta` }, 1);
    expect(byAction.rows).toHaveLength(1);
    expect(byAction.rows[0]?.targetId).toBe("order-1");

    const byTarget = await listAuditLogs(admin.id, { targetId: "prod-1" }, 1);
    expect(byTarget.rows.some((row) => row.action === `${ACTION_PREFIX}alpha`)).toBe(true);
  });

  it("rejects an admin without the Audit permission", async () => {
    const viewer = await makeAdmin([{ module: "UsersRolesAudit", action: "View" }]);
    await expect(listAuditLogs(viewer.id, {}, 1)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("audit-log-admin.service — exportAuditLogsCsv", () => {
  it("produces a CSV with a header row and one row per matching entry", async () => {
    const admin = await makeAdmin([{ module: "UsersRolesAudit", action: "Export" }]);
    await prisma.auditLog.create({ data: { actorId: admin.id, action: `${ACTION_PREFIX}export1`, module: "Products", metadata: { from: "a", to: "b" } } });
    await prisma.auditLog.create({ data: { actorId: admin.id, action: `${ACTION_PREFIX}export2`, module: "Products" } });

    const csv = await exportAuditLogsCsv(admin.id, { action: `${ACTION_PREFIX}export1` });
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("Timestamp,Actor,Action,Module,Target Type,Target ID,Metadata");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(admin.email);
    expect(lines[1]).toContain(`${ACTION_PREFIX}export1`);
  });

  it("CSV-escapes a metadata value whose JSON serialization contains a comma and quotes, keeping it as one field", async () => {
    const admin = await makeAdmin([{ module: "UsersRolesAudit", action: "Export" }]);
    await prisma.auditLog.create({ data: { actorId: admin.id, action: `${ACTION_PREFIX}escape`, module: "Products", metadata: { note: 'has, a comma and "quotes"' } } });

    const csv = await exportAuditLogsCsv(admin.id, { action: `${ACTION_PREFIX}escape` });
    const lines = csv.trim().split("\n");
    const metadataJson = JSON.stringify({ note: 'has, a comma and "quotes"' });
    // RFC 4180: the whole field is wrapped in a quote pair, and every
    // literal `"` inside it (including the ones JSON.stringify already
    // added around "quotes") is doubled.
    expect(lines[1]).toContain(`"${metadataJson.replace(/"/g, '""')}"`);
  });

  it("rejects an admin without the Export permission", async () => {
    const viewer = await makeAdmin([{ module: "UsersRolesAudit", action: "Audit" }]);
    await expect(exportAuditLogsCsv(viewer.id, {})).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
