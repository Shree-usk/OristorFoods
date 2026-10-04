// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getExecutiveSummary } from "@/services/executive-dashboard.service";
import { PermissionDeniedError } from "@/services/permission.errors";

const EMAIL_DOMAIN = "@exec-dashboard-svc-test.test";
const ROLE_KEY_PREFIX = "exec-dashboard-svc-test-role-";
const ORDER_PREFIX = "EXEC-DASH-ORDER-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Exec Dashboard Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

function makeFullAccessAdmin() {
  return makeAdmin([{ module: "CRMAnalytics", action: "View" }]);
}

async function makeCustomer() {
  sequence += 1;
  return prisma.user.create({ data: { email: `customer-${sequence}${EMAIL_DOMAIN}` } });
}

async function makeOrder(userId: string | null, grandTotal: string, createdAt: Date) {
  sequence += 1;
  return prisma.order.create({
    data: {
      orderNumber: `${ORDER_PREFIX}${sequence}`,
      idempotencyKey: `idem-${ORDER_PREFIX}${sequence}`,
      userId,
      status: "Confirmed",
      subtotal: grandTotal,
      deliveryCharge: "0.00",
      grandTotal,
      deliveryZoneName: "Western",
      shipRecipientName: "Test Customer",
      shipPhone: "+94 77 123 4567",
      shipLine1: "10 Test Lane",
      shipCity: "Colombo",
      createdAt,
    },
  });
}

afterEach(async () => {
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: ORDER_PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("executive-dashboard.service — permission gating", () => {
  it("rejects an admin without CRMAnalytics:View", async () => {
    const stranger = await makeAdmin([]);
    await expect(getExecutiveSummary(stranger.id, new Date("2026-02-01"), new Date("2026-02-28"))).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("executive-dashboard.service — period-over-period comparison", () => {
  it("compares revenue and AOV against the immediately preceding period of equal length", async () => {
    const admin = await makeFullAccessAdmin();
    const customer = await makeCustomer();
    // Current period: 2026-02-15 to 2026-02-28 (14 days). Prior period of equal length: 2026-02-01 to 2026-02-14.
    await makeOrder(customer.id, "100.00", new Date("2026-02-20"));
    await makeOrder(customer.id, "200.00", new Date("2026-02-22"));
    await makeOrder(customer.id, "100.00", new Date("2026-02-05"));

    const summary = await getExecutiveSummary(admin.id, new Date("2026-02-15"), new Date("2026-02-28T23:59:59.999Z"));

    expect(summary.revenue.current).toBe(300);
    expect(summary.revenue.previous).toBe(100);
    expect(summary.revenue.changePercent).toBeCloseTo(200, 5);
    expect(summary.averageOrderValue.current).toBe(150);
    expect(summary.averageOrderValue.previous).toBe(100);
  });

  it("reports a null changePercent when the prior period had zero and the current period does not", async () => {
    const admin = await makeFullAccessAdmin();
    const customer = await makeCustomer();
    await makeOrder(customer.id, "500.00", new Date("2026-03-20"));

    const summary = await getExecutiveSummary(admin.id, new Date("2026-03-15"), new Date("2026-03-28T23:59:59.999Z"));

    expect(summary.revenue.previous).toBe(0);
    expect(summary.revenue.current).toBe(500);
    expect(summary.revenue.changePercent).toBeNull();
  });

  it("reports a zero changePercent when both periods are zero", async () => {
    const admin = await makeFullAccessAdmin();
    const summary = await getExecutiveSummary(admin.id, new Date("2026-04-15"), new Date("2026-04-28T23:59:59.999Z"));
    expect(summary.revenue.current).toBe(0);
    expect(summary.revenue.previous).toBe(0);
    expect(summary.revenue.changePercent).toBe(0);
  });
});

describe("executive-dashboard.service — Core Web Vitals honesty", () => {
  it("always reports Core Web Vitals as unavailable, never fabricated", async () => {
    const admin = await makeFullAccessAdmin();
    const summary = await getExecutiveSummary(admin.id, new Date("2026-05-01"), new Date("2026-05-31"));
    expect(summary.coreWebVitals).toEqual({ available: false });
  });
});
