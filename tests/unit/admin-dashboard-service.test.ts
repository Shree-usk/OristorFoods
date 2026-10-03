// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { createProduct } from "@/repositories/product.repository";
import { getDashboardSummary } from "@/services/admin-dashboard.service";
import { updateLowStockThreshold } from "@/services/system-settings.service";
import { cleanupRecipes, makeCategory, makeRecipe } from "./recipe-fixtures";

const EMAIL_DOMAIN = "@admin-dash-svc-test.test";
const ROLE_KEY_PREFIX = "admin-dash-svc-test-role-";
const SKU_PREFIX = "ADMIN-DASH-SVC-SKU-";
const ORDER_PREFIX = "ADMIN-DASH-SVC-ORDER-";
const PAY_REF_PREFIX = "ADMIN-DASH-SVC-PAY-";
let sequence = 0;

async function makeRole(grants: { module: AdminModule; action?: AdminAction }[] = []) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Admin Dash Svc Test Role ${sequence}` } });
  if (grants.length > 0) {
    await prisma.rolePermission.createMany({
      data: grants.map((grant) => ({ roleId: role.id, module: grant.module, action: grant.action ?? "View" })),
    });
  }
  return role;
}

async function makeAdminUser(roleId: string) {
  sequence += 1;
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId } });
}

async function makeCustomer() {
  sequence += 1;
  return prisma.user.create({ data: { email: `customer-${sequence}${EMAIL_DOMAIN}` } });
}

async function makeProduct(overrides: { stockQuantity?: number; status?: "Published" | "Draft" } = {}) {
  sequence += 1;
  return createProduct({
    sku: `${SKU_PREFIX}${sequence}`,
    slug: `admin-dash-svc-product-${sequence}`,
    name: "Admin Dash Svc Test Product",
    status: overrides.status ?? "Published",
    stockQuantity: overrides.stockQuantity ?? 100,
  });
}

async function makeOrder(overrides: { status?: "Confirmed" | "Cancelled"; grandTotal?: string } = {}) {
  sequence += 1;
  return prisma.order.create({
    data: {
      orderNumber: `${ORDER_PREFIX}${sequence}`,
      idempotencyKey: `idem-${ORDER_PREFIX}${sequence}`,
      status: overrides.status ?? "Confirmed",
      subtotal: overrides.grandTotal ?? "100.00",
      deliveryCharge: "0.00",
      grandTotal: overrides.grandTotal ?? "100.00",
      deliveryZoneName: "Western",
      shipRecipientName: "Test Customer",
      shipPhone: "+94 77 123 4567",
      shipLine1: "10 Test Lane",
      shipCity: "Colombo",
    },
  });
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  await prisma.inventorySetting.deleteMany({});
  await prisma.orderIntegrationEvent.deleteMany({ where: { order: { orderNumber: { startsWith: ORDER_PREFIX } } } });
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: ORDER_PREFIX } } });
  await prisma.payment.deleteMany({ where: { providerReference: { startsWith: PAY_REF_PREFIX } } });
  await prisma.review.deleteMany({ where: { product: { sku: { startsWith: SKU_PREFIX } } } });
  await prisma.question.deleteMany({ where: { product: { sku: { startsWith: SKU_PREFIX } } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.supportTicket.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.rewardTransaction.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.referralAttribution.deleteMany({ where: { referrer: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  // Clears the RecipeReview fixture's Recipe/RecipeCategory (RecipeReview
  // cascades off Recipe) plus any BlogComment/BlogPost/BlogAuthor fixtures —
  // see recipe-fixtures.ts's own doc comment on why this is a full-table wipe.
  await cleanupRecipes();
});

describe("admin-dashboard.service", () => {
  it("includes only the widgets whose module is granted, with correct real data", async () => {
    const role = await makeRole([
      { module: "Orders" },
      { module: "Reviews" },
      { module: "QA" },
      { module: "Products" },
      { module: "RewardsReferrals" },
      { module: "Customers" },
      { module: "ERPIntegration" },
    ]);
    const admin = await makeAdminUser(role.id);

    // Orders: one Confirmed (counts), one Cancelled (excluded from revenue).
    await makeOrder({ status: "Confirmed", grandTotal: "500.00" });
    const cancelledOrder = await makeOrder({ status: "Cancelled", grandTotal: "999.00" });
    await prisma.payment.create({ data: { provider: "test", providerReference: `${PAY_REF_PREFIX}${cancelledOrder.id}`, status: "Failed", amount: "999.00" } });

    // Reviews module: one pending review, one pending recipe review, one pending blog comment.
    const product = await makeProduct();
    const lowStockProduct = await makeProduct({ stockQuantity: 3 });
    const reviewer = await makeCustomer();
    await prisma.review.create({ data: { productId: product.id, userId: reviewer.id, rating: 4, title: "Good", body: "Nice product." } });

    const category = await makeCategory();
    const recipe = await makeRecipe(category.id);
    await prisma.recipeReview.create({ data: { recipeId: recipe.id, customerId: reviewer.id, rating: 5 } });

    const author = await prisma.blogAuthor.create({ data: { name: "Admin Dash Svc Test Author", slug: `admin-dash-svc-author-${sequence}` } });
    const post = await prisma.blogPost.create({
      data: { slug: `admin-dash-svc-post-${sequence}`, title: "Test Post", excerpt: "x", bodyContent: "x", authorId: author.id },
    });
    await prisma.blogComment.create({ data: { postId: post.id, authorName: "Commenter", authorEmail: "commenter@test.com", body: "A comment.", status: "Pending" } });

    // QA module: one pending question.
    await prisma.question.create({ data: { productId: product.id, userId: reviewer.id, text: "Is this gluten-free?" } });

    // RewardsReferrals: one redemption today, one referral signup today.
    const referrer = await makeCustomer();
    const referred = await makeCustomer();
    await prisma.rewardTransaction.create({ data: { userId: reviewer.id, type: "Redeemed", points: -50 } });
    await prisma.referralAttribution.create({ data: { referrerUserId: referrer.id, referredUserId: referred.id } });

    // Customers module: two support tickets in different statuses.
    const ticketOwner = await makeCustomer();
    await prisma.supportTicket.create({ data: { userId: ticketOwner.id, category: "Product", subject: "s1", message: "m1", status: "Open" } });
    await prisma.supportTicket.create({ data: { userId: ticketOwner.id, category: "Product", subject: "s2", message: "m2", status: "Resolved" } });

    // ERPIntegration module: one pending, one failed, one processed event.
    const erpOrder = await makeOrder();
    await prisma.orderIntegrationEvent.create({ data: { orderId: erpOrder.id, eventType: "order.confirmed", payload: {}, status: "Pending" } });
    await prisma.orderIntegrationEvent.create({ data: { orderId: erpOrder.id, eventType: "order.confirmed", payload: {}, status: "Failed" } });
    await prisma.orderIntegrationEvent.create({
      data: { orderId: erpOrder.id, eventType: "order.confirmed", payload: {}, status: "Processed", processedAt: new Date() },
    });

    const summary = await getDashboardSummary(admin.id);

    // erpOrder (seeded above for the ERP widget) is also a Confirmed order
    // placed "today", so it legitimately counts toward today's revenue too.
    expect(summary.revenueToday).toEqual({ orderCount: 2, grandTotal: "600" });
    expect(summary.failedPayments).toEqual({ count: 1 });
    expect(summary.pendingModeration).toEqual({ reviews: 1, recipeReviews: 1, blogComments: 1 });
    expect(summary.pendingProductQuestions).toEqual({ count: 1 });
    expect(summary.lowStock).toEqual({ count: 1, threshold: 10 });
    expect(lowStockProduct.stockQuantity).toBe(3);
    expect(summary.rewardsReferrals).toEqual({ redemptions: 1, referralSignups: 1 });
    expect(summary.supportTickets).toEqual({ open: 1, inProgress: 0, resolved: 1, closed: 0 });
    expect(summary.erpSyncStatus?.pending).toBe(1);
    expect(summary.erpSyncStatus?.failed).toBe(1);
    expect(summary.erpSyncStatus?.lastProcessedAt).not.toBeNull();
    expect(summary.placeholders).toEqual({ liveVisitors: false, exportEnquiries: false, systemHealth: false });
  });

  it("omits every real widget and placeholder for a role with no permissions", async () => {
    const role = await makeRole();
    const admin = await makeAdminUser(role.id);

    const summary = await getDashboardSummary(admin.id);

    expect(summary).toEqual({ placeholders: { liveVisitors: false, exportEnquiries: false, systemHealth: false } });
  });

  it("gates the placeholder widgets on their own module permission, independent of real widgets", async () => {
    const role = await makeRole([{ module: "CRMAnalytics" }, { module: "ExportPortal" }]);
    const admin = await makeAdminUser(role.id);
    await makeOrder({ status: "Confirmed", grandTotal: "123.00" });

    const summary = await getDashboardSummary(admin.id);

    expect(summary.revenueToday).toBeUndefined();
    expect(summary.placeholders).toEqual({ liveVisitors: true, exportEnquiries: true, systemHealth: false });
  });

  it("a role granted only Orders:View sees revenue and failed payments but nothing else", async () => {
    const role = await makeRole([{ module: "Orders" }]);
    const admin = await makeAdminUser(role.id);
    await makeOrder({ status: "Confirmed", grandTotal: "250.00" });

    const summary = await getDashboardSummary(admin.id);

    expect(summary.revenueToday).toEqual({ orderCount: 1, grandTotal: "250" });
    expect(summary.failedPayments).toEqual({ count: 0 });
    expect(summary.pendingModeration).toBeUndefined();
    expect(summary.lowStock).toBeUndefined();
    expect(summary.rewardsReferrals).toBeUndefined();
    expect(summary.supportTickets).toBeUndefined();
    expect(summary.erpSyncStatus).toBeUndefined();
  });

  it("reads the low-stock threshold from system-settings.service.ts, not a hardcoded constant", async () => {
    const settingsRole = await makeRole([{ module: "SystemSettings", action: "Edit" }]);
    const settingsAdmin = await makeAdminUser(settingsRole.id);
    // 15 > the old hardcoded 10 — a stock level of 12 only counts as
    // low stock if the dashboard is actually reading this configured
    // value rather than the former hardcoded constant.
    await updateLowStockThreshold(settingsAdmin.id, 15);

    const role = await makeRole([{ module: "Products" }]);
    const admin = await makeAdminUser(role.id);
    await makeProduct({ stockQuantity: 12 });

    const summary = await getDashboardSummary(admin.id);

    expect(summary.lowStock).toEqual({ count: 1, threshold: 15 });
  });
});
