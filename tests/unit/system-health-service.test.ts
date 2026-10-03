// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getSystemHealth } from "@/services/system-health.service";
import { PermissionDeniedError } from "@/services/permission.errors";

const EMAIL_DOMAIN = "@system-health-svc-test.test";
const ROLE_KEY_PREFIX = "system-health-svc-test-role-";
const ORDER_PREFIX = "SYSTEM-HEALTH-SVC-TEST-ORDER-";
const SYNC_JOB_TYPE_PREFIX = "SystemHealthSvcTest ";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `System Health Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

afterEach(async () => {
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  await prisma.syncJob.deleteMany({ where: { jobType: { startsWith: SYNC_JOB_TYPE_PREFIX } } });
  await prisma.orderIntegrationEvent.deleteMany({ where: { order: { orderNumber: { startsWith: ORDER_PREFIX } } } });
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: ORDER_PREFIX } } });
});

describe("system-health.service", () => {
  it("reflects real SyncJob/OrderIntegrationEvent data in the ERP section, and reports the other sections as unavailable", async () => {
    const admin = await makeAdmin([{ module: "UsersRolesAudit", action: "View" }]);

    await prisma.syncJob.create({ data: { jobType: `${SYNC_JOB_TYPE_PREFIX}1`, status: "Queued", createdById: admin.id } });
    await prisma.syncJob.create({ data: { jobType: `${SYNC_JOB_TYPE_PREFIX}2`, status: "Failed", createdById: admin.id } });

    sequence += 1;
    const order = await prisma.order.create({
      data: {
        orderNumber: `${ORDER_PREFIX}${sequence}`,
        idempotencyKey: `idem-${ORDER_PREFIX}${sequence}`,
        status: "Confirmed",
        subtotal: "100.00",
        deliveryCharge: "0.00",
        grandTotal: "100.00",
        deliveryZoneName: "Western",
        shipRecipientName: "Test Customer",
        shipPhone: "+94 77 123 4567",
        shipLine1: "10 Test Lane",
        shipCity: "Colombo",
      },
    });
    await prisma.orderIntegrationEvent.create({ data: { orderId: order.id, eventType: "order.confirmed", payload: {}, status: "Failed" } });

    const health = await getSystemHealth(admin.id);

    expect(health.erp.syncQueue.queued).toBeGreaterThanOrEqual(1);
    expect(health.erp.syncQueue.failed).toBeGreaterThanOrEqual(1);
    expect(health.erp.orderOutbox.failed).toBeGreaterThanOrEqual(1);
    expect(health.uptime).toEqual({ available: false });
    expect(health.errorRate).toEqual({ available: false });
    expect(health.lastBackupAt).toEqual({ available: false });
  });

  it("rejects an admin without View permission", async () => {
    const stranger = await makeAdmin([]);
    await expect(getSystemHealth(stranger.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
