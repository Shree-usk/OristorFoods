// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { PermissionDeniedError } from "@/services/permission.errors";
import {
  getCartCrossSell,
  getFrequentlyBoughtTogether,
  getHomepageRecommendations,
  getSimilarProducts,
  recomputeProductAssociations,
  trackInteraction,
} from "@/services/recommendation.service";

const EMAIL_DOMAIN = "@recommendation-svc-test.test";
const ROLE_KEY_PREFIX = "recommendation-svc-test-role-";
const SKU_PREFIX = "RECO-SVC-SKU-";
const ORDER_PREFIX = "RECO-SVC-ORDER-";
const FLAG_KEY = "recommendations.behavior-based";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Reco Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

async function makeCustomer() {
  sequence += 1;
  return prisma.user.create({ data: { email: `customer-${sequence}${EMAIL_DOMAIN}` } });
}

async function makeProduct(overrides: { inStock?: boolean; price?: string } = {}) {
  sequence += 1;
  const product = await createProduct({
    sku: `${SKU_PREFIX}${sequence}`,
    slug: `reco-svc-product-${sequence}`,
    name: `Reco Svc Test Product ${sequence}`,
    status: "Published",
    stockQuantity: 100,
    inStock: overrides.inStock ?? true,
  });
  await createStandardPrice({ product: { connect: { id: product.id } }, price: overrides.price ?? "100.00" });
  return product;
}

async function makeOrder(userId: string | null, items: { product: { id: string; name: string; sku: string }; quantity: number }[]) {
  sequence += 1;
  const grandTotal = items.reduce((sum, item) => sum + 100 * item.quantity, 0);
  return prisma.order.create({
    data: {
      orderNumber: `${ORDER_PREFIX}${sequence}`,
      idempotencyKey: `idem-${ORDER_PREFIX}${sequence}`,
      userId,
      status: "Confirmed",
      subtotal: grandTotal.toFixed(2),
      deliveryCharge: "0.00",
      grandTotal: grandTotal.toFixed(2),
      deliveryZoneName: "Western",
      shipRecipientName: "Test Customer",
      shipPhone: "+94 77 123 4567",
      shipLine1: "10 Test Lane",
      shipCity: "Colombo",
      items: {
        create: items.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          productSku: item.product.sku,
          unitPrice: "100.00",
          quantity: item.quantity,
          lineTotal: (100 * item.quantity).toFixed(2),
        })),
      },
    },
  });
}

async function setFeatureFlag(enabled: boolean) {
  await prisma.featureFlag.upsert({ where: { key: FLAG_KEY }, update: { enabled }, create: { key: FLAG_KEY, enabled } });
}

afterEach(async () => {
  // This file never calls trackRecommendationEvent, so RecommendationEvent
  // has nothing of ours to clean up — no full-table wipe needed/wanted here.
  await prisma.productInteractionEvent.deleteMany({ where: { product: { sku: { startsWith: SKU_PREFIX } } } });
  await prisma.productAssociation.deleteMany({ where: { sourceProduct: { sku: { startsWith: SKU_PREFIX } } } });
  await prisma.orderItem.deleteMany({ where: { order: { orderNumber: { startsWith: ORDER_PREFIX } } } });
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: ORDER_PREFIX } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  await prisma.featureFlag.deleteMany({ where: { key: FLAG_KEY } });
});

describe("recommendation.service — homepage: cold-start fallback", () => {
  it("falls back to best-sellers for an anonymous visitor", async () => {
    const bestSeller = await makeProduct();
    const slowMover = await makeProduct();
    await makeOrder(null, [{ product: bestSeller, quantity: 5 }]);
    await makeOrder(null, [{ product: slowMover, quantity: 1 }]);

    const { products, personalized } = await getHomepageRecommendations({ customerId: null, sessionId: "anon-session", limit: 10 });

    expect(personalized).toBe(false);
    expect(products[0]?.id).toBe(bestSeller.id);
  });

  it("falls back to best-sellers for a logged-in customer below the cold-start interaction threshold", async () => {
    await setFeatureFlag(true);
    const bestSeller = await makeProduct();
    await makeOrder(null, [{ product: bestSeller, quantity: 3 }]);
    const customer = await makeCustomer();

    const { personalized } = await getHomepageRecommendations({ customerId: customer.id, sessionId: null, limit: 10 });
    expect(personalized).toBe(false);
  });

  it("excludes out-of-stock products from the cold-start fallback", async () => {
    const outOfStock = await makeProduct({ inStock: false });
    await makeOrder(null, [{ product: outOfStock, quantity: 10 }]);

    const { products } = await getHomepageRecommendations({ customerId: null, sessionId: "anon-session", limit: 10 });
    expect(products.map((p) => p.id)).not.toContain(outOfStock.id);
  });
});

describe("recommendation.service — homepage: personalized (co-occurrence)", () => {
  it("personalizes for a customer above the cold-start threshold when the feature flag is enabled", async () => {
    await setFeatureFlag(true);
    const customer = await makeCustomer();
    const seed = await makeProduct();
    const similar = await makeProduct();

    for (let i = 0; i < 4; i++) await trackInteraction({ customerId: customer.id, sessionId: null, productId: seed.id, eventType: "View" });
    await prisma.productAssociation.create({ data: { sourceProductId: seed.id, targetProductId: similar.id, associationType: "Similar", score: 5 } });

    const { products, personalized } = await getHomepageRecommendations({ customerId: customer.id, sessionId: null, limit: 10 });

    expect(personalized).toBe(true);
    expect(products.map((p) => p.id)).toContain(similar.id);
  });

  it("stays rules-based when the feature flag is disabled, even with enough interaction history", async () => {
    await setFeatureFlag(false);
    const customer = await makeCustomer();
    const seed = await makeProduct();
    for (let i = 0; i < 5; i++) await trackInteraction({ customerId: customer.id, sessionId: null, productId: seed.id, eventType: "View" });

    const { personalized } = await getHomepageRecommendations({ customerId: customer.id, sessionId: null, limit: 10 });
    expect(personalized).toBe(false);
  });
});

describe("recommendation.service — PDP similar products", () => {
  it("prefers precomputed Similar associations over the category-match fallback", async () => {
    const source = await makeProduct();
    const associated = await makeProduct();
    await prisma.productAssociation.create({ data: { sourceProductId: source.id, targetProductId: associated.id, associationType: "Similar", score: 3 } });

    const products = await getSimilarProducts({ productId: source.id, categoryIds: [] });
    expect(products.map((p) => p.id)).toEqual([associated.id]);
  });

  it("falls back to the category-match baseline when no association exists yet", async () => {
    const category = await prisma.category.create({ data: { name: `Reco Svc Test Category ${sequence}`, slug: `reco-svc-category-${++sequence}` } });
    sequence += 1;
    const source = await createProduct({ sku: `${SKU_PREFIX}${sequence}`, slug: `reco-svc-product-${sequence}`, name: "Source", status: "Published", stockQuantity: 10, categories: { connect: [{ id: category.id }] } });
    await createStandardPrice({ product: { connect: { id: source.id } }, price: "100.00" });
    sequence += 1;
    const sameCategory = await createProduct({ sku: `${SKU_PREFIX}${sequence}`, slug: `reco-svc-product-${sequence}`, name: "Same Category", status: "Published", stockQuantity: 10, categories: { connect: [{ id: category.id }] } });
    await createStandardPrice({ product: { connect: { id: sameCategory.id } }, price: "100.00" });

    const products = await getSimilarProducts({ productId: source.id, categoryIds: [category.id] });
    expect(products.map((p) => p.id)).toContain(sameCategory.id);

    await prisma.category.deleteMany({ where: { id: category.id } });
  });
});

describe("recommendation.service — frequently bought together honesty", () => {
  it("returns an empty list rather than a fabricated fallback when there is no co-purchase data", async () => {
    const product = await makeProduct();
    const result = await getFrequentlyBoughtTogether({ productId: product.id });
    expect(result).toEqual([]);
  });
});

describe("recommendation.service — cart cross-sell", () => {
  it("excludes products already in the cart", async () => {
    const inCart = await makeProduct();
    const associated = await makeProduct();
    await prisma.productAssociation.create({ data: { sourceProductId: inCart.id, targetProductId: associated.id, associationType: "FrequentlyBoughtTogether", score: 2 } });

    const result = await getCartCrossSell({ productIds: [inCart.id] });
    expect(result.map((p) => p.id)).toEqual([associated.id]);
    expect(result.map((p) => p.id)).not.toContain(inCart.id);
  });
});

describe("recommendation.service — recomputeProductAssociations", () => {
  it("writes directional FrequentlyBoughtTogether pairs from real co-purchase history", async () => {
    const admin = await makeAdmin([{ module: "Products", action: "Edit" }]);
    const productA = await makeProduct();
    const productB = await makeProduct();
    await makeOrder(null, [{ product: productA, quantity: 1 }, { product: productB, quantity: 1 }]);
    await makeOrder(null, [{ product: productA, quantity: 1 }, { product: productB, quantity: 1 }]);

    const result = await recomputeProductAssociations(admin.id);
    expect(result.frequentlyBoughtTogetherPairsWritten).toBeGreaterThanOrEqual(2);

    const aToB = await prisma.productAssociation.findFirst({ where: { sourceProductId: productA.id, targetProductId: productB.id, associationType: "FrequentlyBoughtTogether" } });
    const bToA = await prisma.productAssociation.findFirst({ where: { sourceProductId: productB.id, targetProductId: productA.id, associationType: "FrequentlyBoughtTogether" } });
    expect(aToB?.score).toBe(2);
    expect(bToA?.score).toBe(2);
  });

  it("requires Products:Edit", async () => {
    const viewOnlyAdmin = await makeAdmin([{ module: "Products", action: "View" }]);
    await expect(recomputeProductAssociations(viewOnlyAdmin.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
