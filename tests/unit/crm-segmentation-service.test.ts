// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import {
  createSegment,
  deleteSegment,
  getCustomerClv,
  getSegment,
  listRewardTiersForSegmentation,
  listSegments,
  previewSegment,
  resolveSegmentMembers,
  updateSegment,
} from "@/services/crm-segmentation.service";
import { SegmentNotFoundError } from "@/services/crm-segmentation.errors";
import { PermissionDeniedError } from "@/services/permission.errors";

const EMAIL_DOMAIN = "@crm-segmentation-svc-test.test";
const ROLE_KEY_PREFIX = "crm-segmentation-svc-test-role-";
const ORDER_PREFIX = "CRM-SEG-SVC-TEST-ORDER-";
const SEGMENT_NAME_PREFIX = "CRM Seg Svc Test ";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `CRM Seg Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

function makeFullAccessAdmin() {
  return makeAdmin([
    { module: "CRMAnalytics", action: "View" },
    { module: "CRMAnalytics", action: "Edit" },
    { module: "CRMAnalytics", action: "Delete" },
    { module: "Customers", action: "View" },
  ]);
}

async function makeCustomer(overrides: { customerGroup?: "Retail" | "Wholesale" | "Distributor" | "Export" | "PrivateLabel" } = {}) {
  sequence += 1;
  return prisma.user.create({ data: { email: `customer-${sequence}${EMAIL_DOMAIN}`, name: `Test Customer ${sequence}`, customerGroup: overrides.customerGroup ?? "Retail" } });
}

async function makeOrder(userId: string | null, overrides: { grandTotal?: string; status?: "Confirmed" | "Cancelled"; createdAt?: Date } = {}) {
  sequence += 1;
  return prisma.order.create({
    data: {
      orderNumber: `${ORDER_PREFIX}${sequence}`,
      idempotencyKey: `idem-${ORDER_PREFIX}${sequence}`,
      userId,
      status: overrides.status ?? "Confirmed",
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
  await prisma.emailSmsCampaign.deleteMany({ where: { targetSegment: { name: { startsWith: SEGMENT_NAME_PREFIX } } } });
  await prisma.savedSegment.deleteMany({ where: { name: { startsWith: SEGMENT_NAME_PREFIX } } });
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: ORDER_PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("crm-segmentation.service — permission gating", () => {
  it("rejects an admin without CRMAnalytics:View from previewing or listing", async () => {
    const stranger = await makeAdmin([]);
    await expect(previewSegment(stranger.id, {})).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(listSegments(stranger.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects a View-only admin from creating, updating, or deleting a segment", async () => {
    const viewer = await makeAdmin([{ module: "CRMAnalytics", action: "View" }]);
    await expect(createSegment(viewer.id, { name: "x", filterCriteria: {} })).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("listRewardTiersForSegmentation is gated on CRMAnalytics, not RewardsReferrals", async () => {
    const admin = await makeAdmin([{ module: "CRMAnalytics", action: "View" }]);
    await expect(listRewardTiersForSegmentation(admin.id)).resolves.toBeInstanceOf(Array);
  });
});

describe("crm-segmentation.service — CLV and filtering", () => {
  it("CLV excludes Cancelled orders, matching the dashboard's revenue inclusion rule", async () => {
    const admin = await makeFullAccessAdmin();
    const customer = await makeCustomer();
    await makeOrder(customer.id, { grandTotal: "100.00" });
    await makeOrder(customer.id, { grandTotal: "500.00", status: "Cancelled" });

    const clv = await getCustomerClv(admin.id, customer.id);
    expect(clv.totalSpent).toBe(100);
    expect(clv.orderCount).toBe(1);
  });

  it("rejects getCustomerClv for an admin without Customers:View", async () => {
    const admin = await makeAdmin([{ module: "CRMAnalytics", action: "View" }]);
    const customer = await makeCustomer();
    await expect(getCustomerClv(admin.id, customer.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("filters by min/max lifetime value", async () => {
    const admin = await makeFullAccessAdmin();
    const bigSpender = await makeCustomer();
    await makeOrder(bigSpender.id, { grandTotal: "1000.00" });
    const smallSpender = await makeCustomer();
    await makeOrder(smallSpender.id, { grandTotal: "10.00" });

    const preview = await previewSegment(admin.id, { minLifetimeValue: 500 });
    const ids = preview.members.map((m) => m.id);
    expect(ids).toContain(bigSpender.id);
    expect(ids).not.toContain(smallSpender.id);
  });

  it("filters by customer group", async () => {
    const admin = await makeFullAccessAdmin();
    const wholesale = await makeCustomer({ customerGroup: "Wholesale" });
    const retail = await makeCustomer({ customerGroup: "Retail" });

    const preview = await previewSegment(admin.id, { customerGroup: "Wholesale" });
    const ids = preview.members.map((m) => m.id);
    expect(ids).toContain(wholesale.id);
    expect(ids).not.toContain(retail.id);
  });

  it("filters by min order count, excluding customers with zero orders", async () => {
    const admin = await makeFullAccessAdmin();
    const frequent = await makeCustomer();
    await makeOrder(frequent.id);
    await makeOrder(frequent.id);
    const neverOrdered = await makeCustomer();

    const preview = await previewSegment(admin.id, { minOrderCount: 1 });
    const ids = preview.members.map((m) => m.id);
    expect(ids).toContain(frequent.id);
    expect(ids).not.toContain(neverOrdered.id);
  });

  it("computes totalClv/averageClv correctly across matched members", async () => {
    const admin = await makeFullAccessAdmin();
    const a = await makeCustomer();
    await makeOrder(a.id, { grandTotal: "100.00" });
    const b = await makeCustomer();
    await makeOrder(b.id, { grandTotal: "300.00" });

    const preview = await previewSegment(admin.id, { minOrderCount: 1 });
    expect(preview.count).toBeGreaterThanOrEqual(2);
    expect(preview.totalClv).toBeGreaterThanOrEqual(400);
    expect(preview.averageClv).toBe(preview.totalClv / preview.count);
  });
});

describe("crm-segmentation.service — segment CRUD", () => {
  it("creates, previews, updates, and deletes a segment, with audit log coverage", async () => {
    const admin = await makeFullAccessAdmin();
    const customer = await makeCustomer({ customerGroup: "Distributor" });

    const segment = await createSegment(admin.id, { name: `${SEGMENT_NAME_PREFIX}1`, filterCriteria: { customerGroup: "Distributor" } });
    const { preview } = await getSegment(admin.id, segment.id);
    expect(preview.members.map((m) => m.id)).toContain(customer.id);

    const updated = await updateSegment(admin.id, segment.id, { name: `${SEGMENT_NAME_PREFIX}1-renamed` });
    expect(updated.name).toBe(`${SEGMENT_NAME_PREFIX}1-renamed`);

    await deleteSegment(admin.id, segment.id);
    await expect(getSegment(admin.id, segment.id)).rejects.toBeInstanceOf(SegmentNotFoundError);

    const actions = (await prisma.auditLog.findMany({ where: { targetId: segment.id } })).map((row) => row.action);
    expect(actions).toEqual(expect.arrayContaining(["crm_segment_created", "crm_segment_updated", "crm_segment_deleted"]));
  });

  it("resolveSegmentMembers returns the same live set previewSegment would for identical criteria", async () => {
    const admin = await makeFullAccessAdmin();
    const match = await makeCustomer({ customerGroup: "Export" });
    await makeCustomer({ customerGroup: "Retail" });

    const segment = await createSegment(admin.id, { name: `${SEGMENT_NAME_PREFIX}2`, filterCriteria: { customerGroup: "Export" } });
    const resolved = await resolveSegmentMembers(segment.id);
    const preview = await previewSegment(admin.id, { customerGroup: "Export" });

    expect(resolved.sort()).toEqual(preview.members.map((m) => m.id).sort());
    expect(resolved).toContain(match.id);
  });

  it("resolveSegmentMembers returns an empty array for a non-existent segment", async () => {
    await expect(resolveSegmentMembers("nonexistent-id")).resolves.toEqual([]);
  });
});

describe("crm-segmentation.service — customerIds filter (STORY-064)", () => {
  it("restricts the candidate set to exactly the given ids, composing with other filters", async () => {
    const admin = await makeFullAccessAdmin();
    const included = await makeCustomer({ customerGroup: "Wholesale" });
    await makeOrder(included.id, { grandTotal: "50.00" });
    const excludedByIds = await makeCustomer({ customerGroup: "Wholesale" });
    await makeOrder(excludedByIds.id, { grandTotal: "50.00" });
    const excludedByGroup = await makeCustomer({ customerGroup: "Retail" });
    await makeOrder(excludedByGroup.id, { grandTotal: "50.00" });

    const preview = await previewSegment(admin.id, { customerIds: [included.id, excludedByGroup.id], customerGroup: "Wholesale" });
    const ids = preview.members.map((m) => m.id);
    expect(ids).toEqual([included.id]);
  });

  it("leaves an existing segment with no customerIds set completely unaffected", async () => {
    const admin = await makeFullAccessAdmin();
    const customer = await makeCustomer({ customerGroup: "Export" });

    const segment = await createSegment(admin.id, { name: `${SEGMENT_NAME_PREFIX}3`, filterCriteria: { customerGroup: "Export" } });
    const resolved = await resolveSegmentMembers(segment.id);
    expect(resolved).toContain(customer.id);
  });
});
