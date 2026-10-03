// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import {
  exportFunnelReportCsv,
  getCustomerReport,
  getFunnelReport,
  getProductsRecipesReport,
  getSalesReport,
} from "@/services/analytics.service";
import { PermissionDeniedError } from "@/services/permission.errors";
import { cleanupRecipes, makeCategory, makeRecipe } from "./recipe-fixtures";

const EMAIL_DOMAIN = "@analytics-svc-test.test";
const ROLE_KEY_PREFIX = "analytics-svc-test-role-";
const SKU_PREFIX = "ANALYTICS-SVC-SKU-";
const ORDER_PREFIX = "ANALYTICS-SVC-ORDER-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Analytics Svc Test Role ${sequence}` } });
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

async function makeProduct(overrides: { categoryIds?: string[] } = {}) {
  sequence += 1;
  return createProduct({
    sku: `${SKU_PREFIX}${sequence}`,
    slug: `analytics-svc-product-${sequence}`,
    name: `Analytics Svc Test Product ${sequence}`,
    status: "Published",
    stockQuantity: 100,
    ...(overrides.categoryIds ? { categories: { connect: overrides.categoryIds.map((id) => ({ id })) } } : {}),
  });
}

async function makeOrder(userId: string | null, items: { product: { id: string; name: string; sku: string }; quantity: number; unitPrice: string }[], overrides: { status?: "Confirmed" | "Cancelled"; createdAt?: Date } = {}) {
  sequence += 1;
  const lineTotal = (unitPrice: string, quantity: number) => (Number(unitPrice) * quantity).toFixed(2);
  const grandTotal = items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
  return prisma.order.create({
    data: {
      orderNumber: `${ORDER_PREFIX}${sequence}`,
      idempotencyKey: `idem-${ORDER_PREFIX}${sequence}`,
      userId,
      status: overrides.status ?? "Confirmed",
      subtotal: grandTotal.toFixed(2),
      deliveryCharge: "0.00",
      grandTotal: grandTotal.toFixed(2),
      deliveryZoneName: "Western",
      shipRecipientName: "Test Customer",
      shipPhone: "+94 77 123 4567",
      shipLine1: "10 Test Lane",
      shipCity: "Colombo",
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
      items: {
        create: items.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          productSku: item.product.sku,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          lineTotal: lineTotal(item.unitPrice, item.quantity),
        })),
      },
    },
    include: { items: true },
  });
}

afterEach(async () => {
  await prisma.orderItem.deleteMany({ where: { order: { orderNumber: { startsWith: ORDER_PREFIX } } } });
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: ORDER_PREFIX } } });
  await prisma.cartItem.deleteMany({ where: { cart: { user: { email: { endsWith: EMAIL_DOMAIN } } } } });
  await prisma.cart.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  await cleanupRecipes();
});

describe("analytics.service — permission gating", () => {
  it("rejects an admin without CRMAnalytics:View from every report", async () => {
    const stranger = await makeAdmin([]);
    const query = { from: new Date("2026-01-01"), to: new Date("2026-01-31"), bucket: "day" as const, limit: 10, metric: "products" as const };
    await expect(getSalesReport(stranger.id, query)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(getCustomerReport(stranger.id, query)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(getProductsRecipesReport(stranger.id, query)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(getFunnelReport(stranger.id, query)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("analytics.service — sales", () => {
  it("buckets revenue/orders by day and excludes Cancelled orders", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    const day1 = new Date("2026-02-01T10:00:00Z");
    const day2 = new Date("2026-02-02T10:00:00Z");

    await makeOrder(null, [{ product, quantity: 2, unitPrice: "100.00" }], { createdAt: day1 });
    await makeOrder(null, [{ product, quantity: 1, unitPrice: "50.00" }], { createdAt: day1 });
    await makeOrder(null, [{ product, quantity: 1, unitPrice: "999.00" }], { createdAt: day1, status: "Cancelled" });
    await makeOrder(null, [{ product, quantity: 3, unitPrice: "100.00" }], { createdAt: day2 });

    const query = { from: new Date("2026-02-01"), to: new Date("2026-02-03"), bucket: "day" as const, limit: 10, metric: "products" as const };
    const report = await getSalesReport(admin.id, query);

    const day1Point = report.trend.find((p) => p.bucket.toISOString().startsWith("2026-02-01"));
    const day2Point = report.trend.find((p) => p.bucket.toISOString().startsWith("2026-02-02"));
    expect(day1Point).toEqual({ bucket: day1Point!.bucket, revenue: 250, orderCount: 2 });
    expect(day2Point).toEqual({ bucket: day2Point!.bucket, revenue: 300, orderCount: 1 });
  });

  it("aggregates sales by category through the many-to-many relation", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await prisma.category.create({ data: { name: `Analytics Svc Test Category ${sequence}`, slug: `analytics-svc-category-${++sequence}` } });
    const product = await makeProduct({ categoryIds: [category.id] });
    await makeOrder(null, [{ product, quantity: 2, unitPrice: "100.00" }]);

    const query = { from: new Date("2000-01-01"), to: new Date("2100-01-01"), bucket: "day" as const, limit: 10, metric: "products" as const };
    const report = await getSalesReport(admin.id, query);

    const row = report.byCategory.find((r) => r.categoryName === category.name);
    expect(row).toEqual({ categoryName: category.name, revenue: 200, quantity: 2 });

    await prisma.category.deleteMany({ where: { id: category.id } });
  });
});

describe("analytics.service — products & recipes", () => {
  it("ranks top products by revenue within the date range", async () => {
    const admin = await makeFullAccessAdmin();
    const bestSeller = await makeProduct();
    const slowMover = await makeProduct();
    await makeOrder(null, [{ product: bestSeller, quantity: 10, unitPrice: "100.00" }]);
    await makeOrder(null, [{ product: slowMover, quantity: 1, unitPrice: "10.00" }]);

    const query = { from: new Date("2000-01-01"), to: new Date("2100-01-01"), bucket: "day" as const, limit: 10, metric: "products" as const };
    const report = await getProductsRecipesReport(admin.id, query);

    expect(report.topProducts[0]?.productId).toBe(bestSeller.id);
    expect(report.topProducts[0]?.revenue).toBe(1000);
  });

  it("ranks top recipes by viewCount", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await makeCategory();
    const popular = await makeRecipe(category.id, { viewCount: 500, avgRating: 4.5, ratingCount: 10 });
    await makeRecipe(category.id, { viewCount: 5 });

    const query = { from: new Date("2000-01-01"), to: new Date("2100-01-01"), bucket: "day" as const, limit: 10, metric: "recipes" as const };
    const report = await getProductsRecipesReport(admin.id, query);

    expect(report.topRecipes[0]?.recipeId).toBe(popular.id);
    expect(report.topRecipes[0]?.avgRating).toBe(4.5);
  });
});

describe("analytics.service — customer retention", () => {
  it("computes the exact repeat-purchase fraction among the period's active customers", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    const repeatCustomer = await makeCustomer();
    const oneTimeCustomer = await makeCustomer();

    // repeatCustomer: one order before the period, one inside it — 2 lifetime orders, active in period.
    await makeOrder(repeatCustomer.id, [{ product, quantity: 1, unitPrice: "50.00" }], { createdAt: new Date("2026-01-01") });
    await makeOrder(repeatCustomer.id, [{ product, quantity: 1, unitPrice: "50.00" }], { createdAt: new Date("2026-03-01") });
    // oneTimeCustomer: exactly one lifetime order, inside the period.
    await makeOrder(oneTimeCustomer.id, [{ product, quantity: 1, unitPrice: "50.00" }], { createdAt: new Date("2026-03-01") });

    const query = { from: new Date("2026-02-15"), to: new Date("2026-03-15"), bucket: "day" as const, limit: 10, metric: "products" as const };
    const report = await getCustomerReport(admin.id, query);

    expect(report.retention).toEqual({ activeCustomers: 2, repeatCustomers: 1, retentionRate: 0.5 });
  });
});

describe("analytics.service — funnel", () => {
  it("reports two real numbers and two honest unavailable placeholders", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    const customer = await makeCustomer();
    const cart = await prisma.cart.create({ data: { userId: customer.id } });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId: product.id, quantity: 1, unitPriceSnapshot: "10.00" } });
    await makeOrder(customer.id, [{ product, quantity: 1, unitPrice: "10.00" }]);

    const query = { from: new Date("2000-01-01"), to: new Date("2100-01-01"), bucket: "day" as const, limit: 10, metric: "products" as const };
    const funnel = await getFunnelReport(admin.id, query);

    expect(funnel.cartsWithItems).toBeGreaterThanOrEqual(1);
    expect(funnel.confirmedOrders).toBeGreaterThanOrEqual(1);
    expect(funnel.visits).toEqual({ available: false });
    expect(funnel.checkout).toEqual({ available: false });
  });

  it("exports the funnel as a CSV with the two real rows and two unavailable rows", async () => {
    const admin = await makeFullAccessAdmin();
    const query = { from: new Date("2000-01-01"), to: new Date("2100-01-01"), bucket: "day" as const, limit: 10, metric: "products" as const };
    const csv = await exportFunnelReportCsv(admin.id, query);
    expect(csv).toContain("Stage,Count");
    expect(csv).toContain("Visits,Not available");
    expect(csv).toContain("Checkout started,Not available");
  });
});
