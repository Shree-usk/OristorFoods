// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { PermissionDeniedError } from "@/services/permission.errors";
import { exportChurnTierToSegment, listChurnScores, recomputeChurnScores } from "@/services/churn-scoring.service";

const EMAIL_DOMAIN = "@churn-scoring-svc-test.test";
const ROLE_KEY_PREFIX = "churn-scoring-svc-test-role-";
const ORDER_PREFIX = "CHURN-SCORING-SVC-TEST-ORDER-";
const SEGMENT_NAME_PREFIX = "AI: ";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Churn Scoring Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

function makeFullAccessAdmin() {
  return makeAdmin([
    { module: "CRMAnalytics", action: "View" },
    { module: "CRMAnalytics", action: "Edit" },
  ]);
}

async function makeCustomer() {
  sequence += 1;
  return prisma.user.create({ data: { email: `customer-${sequence}${EMAIL_DOMAIN}`, name: `Test Customer ${sequence}` } });
}

async function makeOrder(userId: string, overrides: { grandTotal?: string; createdAt?: Date } = {}) {
  sequence += 1;
  return prisma.order.create({
    data: {
      orderNumber: `${ORDER_PREFIX}${sequence}`,
      idempotencyKey: `idem-${ORDER_PREFIX}${sequence}`,
      userId,
      status: "Confirmed",
      subtotal: overrides.grandTotal ?? "100.00",
      deliveryCharge: "0.00",
      grandTotal: overrides.grandTotal ?? "100.00",
      deliveryZoneName: "Western",
      shipRecipientName: "Test Customer",
      shipPhone: "+94 77 123 4567",
      shipLine1: "10 Test Lane",
      shipCity: "Colombo",
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    },
  });
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.savedSegment.deleteMany({ where: { name: { startsWith: SEGMENT_NAME_PREFIX } } });
  await prisma.customerChurnScore.deleteMany({ where: { customer: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: ORDER_PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("churn-scoring.service — permission gating", () => {
  it("rejects an admin without CRMAnalytics:Edit from recomputing", async () => {
    const viewer = await makeAdmin([{ module: "CRMAnalytics", action: "View" }]);
    await expect(recomputeChurnScores(viewer.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects an admin without CRMAnalytics:View from listing", async () => {
    const stranger = await makeAdmin([]);
    await expect(listChurnScores(stranger.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("churn-scoring.service — RFM scoring formula + tiering", () => {
  it("scores a recent, frequent, high-spend customer as Low risk and a stale, single-order, low-spend customer as High risk", async () => {
    const admin = await makeFullAccessAdmin();
    const loyal = await makeCustomer();
    for (let i = 0; i < 8; i++) await makeOrder(loyal.id, { grandTotal: "5000.00", createdAt: new Date() });
    const atRisk = await makeCustomer();
    await makeOrder(atRisk.id, { grandTotal: "10.00", createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000) });

    const result = await recomputeChurnScores(admin.id);
    expect(result.customersScored).toBeGreaterThanOrEqual(2);

    const loyalScore = await prisma.customerChurnScore.findUnique({ where: { customerId: loyal.id } });
    const atRiskScore = await prisma.customerChurnScore.findUnique({ where: { customerId: atRisk.id } });
    expect(loyalScore?.riskTier).toBe("Low");
    expect(atRiskScore?.riskTier).toBe("High");
    expect(atRiskScore!.score).toBeGreaterThan(loyalScore!.score);
  });

  it("only scores customers with at least one order — never fabricates a score for someone who never purchased", async () => {
    const admin = await makeFullAccessAdmin();
    const neverOrdered = await makeCustomer();

    await recomputeChurnScores(admin.id);

    const score = await prisma.customerChurnScore.findUnique({ where: { customerId: neverOrdered.id } });
    expect(score).toBeNull();
  });

  it("honestly records engagementSignalsAvailable: false — no fabricated engagement signal", async () => {
    const admin = await makeFullAccessAdmin();
    const customer = await makeCustomer();
    await makeOrder(customer.id);

    await recomputeChurnScores(admin.id);

    const score = await prisma.customerChurnScore.findUnique({ where: { customerId: customer.id } });
    expect((score?.signalBreakdown as { engagementSignalsAvailable: boolean }).engagementSignalsAvailable).toBe(false);
  });

  it("re-running recompute upserts rather than duplicating rows", async () => {
    const admin = await makeFullAccessAdmin();
    const customer = await makeCustomer();
    await makeOrder(customer.id);

    await recomputeChurnScores(admin.id);
    await recomputeChurnScores(admin.id);

    const count = await prisma.customerChurnScore.count({ where: { customerId: customer.id } });
    expect(count).toBe(1);
  });
});

describe("churn-scoring.service — listChurnScores tierCounts", () => {
  it("returns the real unfiltered tier distribution alongside the (possibly filtered) paginated rows", async () => {
    const admin = await makeFullAccessAdmin();
    const atRisk = await makeCustomer();
    await makeOrder(atRisk.id, { grandTotal: "10.00", createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000) });
    const loyal = await makeCustomer();
    for (let i = 0; i < 8; i++) await makeOrder(loyal.id, { grandTotal: "5000.00" });

    await recomputeChurnScores(admin.id);
    const filtered = await listChurnScores(admin.id, { riskTier: "High" });

    expect(filtered.rows).toHaveLength(filtered.total);
    expect(filtered.rows.every((row) => row.riskTier === "High")).toBe(true);
    expect(filtered.tierCounts.High).toBeGreaterThanOrEqual(1);
    expect(filtered.tierCounts.Low).toBeGreaterThanOrEqual(1);
  });
});

describe("churn-scoring.service — exportChurnTierToSegment", () => {
  it("creates a real SavedSegment whose customerIds exactly matches that tier's current members", async () => {
    const admin = await makeFullAccessAdmin();
    const atRisk = await makeCustomer();
    await makeOrder(atRisk.id, { grandTotal: "10.00", createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000) });
    const loyal = await makeCustomer();
    for (let i = 0; i < 8; i++) await makeOrder(loyal.id, { grandTotal: "5000.00" });

    await recomputeChurnScores(admin.id);
    const segment = await exportChurnTierToSegment(admin.id, "High");

    const criteria = segment.filterCriteria as { customerIds?: string[] };
    expect(criteria.customerIds).toContain(atRisk.id);
    expect(criteria.customerIds).not.toContain(loyal.id);
  });
});
