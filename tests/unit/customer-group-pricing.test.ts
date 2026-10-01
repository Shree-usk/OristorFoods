// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createCustomerGroupPrice, createStandardPrice } from "@/repositories/pricing.repository";
import { addItem, getCart } from "@/services/cart.service";
import { getProductDetail, getProductsByIds, getProductsForCompare, listProducts } from "@/services/product.service";
import { resolveCustomerGroupForUser } from "@/services/pricing.service";
import { reorderPastOrder } from "@/services/customer-order-history.service";
import { searchProducts } from "@/services/search.service";
import { getWishlist } from "@/services/wishlist.service";

/**
 * STORY-071. Proves a non-Retail customer actually receives non-Retail
 * pricing end-to-end across the four wired call sites (not just a unit
 * test on resolvePrice() in isolation, which already passed before this
 * story — the AC's own wording). Each product below has both a standard
 * price and a Wholesale CustomerGroupPrice, so a wrong/missing group
 * resolution is caught as "resolves to the standard price" rather than
 * silently passing.
 */

const EMAIL_PREFIX = "cg-pricing-";
const SKU_PREFIX = "CG-PRICING-SKU-";
let sequence = 0;

async function makeWholesaleCustomer() {
  sequence += 1;
  return prisma.user.create({ data: { email: `${EMAIL_PREFIX}${sequence}@test.com`, customerGroup: "Wholesale" } });
}

async function makeRetailCustomer() {
  sequence += 1;
  return prisma.user.create({ data: { email: `${EMAIL_PREFIX}${sequence}@test.com` } });
}

async function makeProductWithTieredPricing() {
  sequence += 1;
  const product = await createProduct({
    sku: `${SKU_PREFIX}${sequence}`,
    slug: `cg-pricing-product-${sequence}`,
    name: `CG Pricing Product ${sequence}`,
    status: "Published",
    stockQuantity: 10,
    images: { create: [{ url: "/images/products/export/curry-powder.webp", altText: "Test", sortOrder: 0, isPrimary: true }] },
  });
  await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });
  await createCustomerGroupPrice({ product: { connect: { id: product.id } }, customerGroup: "Wholesale", price: "350.00" });
  return product;
}

afterEach(async () => {
  await prisma.orderItem.deleteMany({ where: { order: { orderNumber: { startsWith: "CG-PRICING-ORDER-" } } } });
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: "CG-PRICING-ORDER-" } } });
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.customerGroupPrice.deleteMany();
  await prisma.standardPrice.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
});

describe("resolveCustomerGroupForUser", () => {
  it("resolves Retail for a guest (null userId)", async () => {
    expect(await resolveCustomerGroupForUser(null)).toBe("Retail");
  });

  it("resolves a customer's stored group", async () => {
    const customer = await makeWholesaleCustomer();
    expect(await resolveCustomerGroupForUser(customer.id)).toBe("Wholesale");
  });

  it("defaults a Retail customer's group to Retail", async () => {
    const customer = await makeRetailCustomer();
    expect(await resolveCustomerGroupForUser(customer.id)).toBe("Retail");
  });
});

describe("cart.service.ts resolves the customer's group", () => {
  it("a Wholesale customer's cart line prices at the wholesale tier", async () => {
    const customer = await makeWholesaleCustomer();
    const product = await makeProductWithTieredPricing();

    await addItem(customer.id, null, product.id, 1);
    const summary = await getCart(customer.id, null);

    expect(summary.items[0]?.unitPrice).toBe(350);
  });

  it("a guest's cart line still prices at the standard (Retail) tier", async () => {
    const product = await makeProductWithTieredPricing();

    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    const summary = await getCart(null, newCookieValue ?? undefined);

    expect(summary.items[0]?.unitPrice).toBe(500);
  });
});

describe("wishlist.service.ts resolves the customer's group", () => {
  it("a Wholesale customer's wishlist shows the wholesale price", async () => {
    const customer = await makeWholesaleCustomer();
    const product = await makeProductWithTieredPricing();
    await prisma.wishlist.create({ data: { userId: customer.id, items: { create: [{ productId: product.id }] } } });

    const items = await getWishlist(customer.id);

    expect(items[0]?.price).toBe(350);
  });
});

describe("customer-order-history.service.ts reorderPastOrder resolves the customer's group", () => {
  it("re-adds a past order's item at the wholesale price, not its original snapshot", async () => {
    const customer = await makeWholesaleCustomer();
    const product = await makeProductWithTieredPricing();
    sequence += 1;
    const order = await prisma.order.create({
      data: {
        orderNumber: `CG-PRICING-ORDER-${sequence}`,
        idempotencyKey: `cg-pricing-idem-${sequence}`,
        userId: customer.id,
        status: "Delivered",
        subtotal: "500.00",
        deliveryCharge: "0.00",
        grandTotal: "500.00",
        deliveryZoneName: "Western",
        shipRecipientName: "Test Customer",
        shipPhone: "+94 77 123 4567",
        shipLine1: "10 Test Lane",
        shipCity: "Colombo",
        items: {
          create: [{ productId: product.id, productName: product.name, productSku: product.sku, unitPrice: "500.00", quantity: 1, lineTotal: "500.00" }],
        },
      },
    });

    await reorderPastOrder(customer.id, order.orderNumber);
    const summary = await getCart(customer.id, null);

    expect(summary.items[0]?.unitPrice).toBe(350);
  });
});

describe("search.service.ts resolves an explicitly-passed customer group", () => {
  // STORY-071: search.service.ts was not in the AC's named 10 call sites,
  // but STORY-024's own entry flagged it alongside cart/wishlist/product
  // as part of the same hardcoded-Retail gap — fixed here too, in the
  // same spirit, documented in this story's architecture-decisions entry.
  it("searchProducts prices a Wholesale caller at the wholesale tier", async () => {
    const product = await makeProductWithTieredPricing();

    const result = await searchProducts(product.name, { customerGroup: "Wholesale" });

    expect(result.items.find((item) => item.id === product.id)?.price).toBe(350);
  });

  it("defaults to the standard (Retail) tier with no customerGroup passed", async () => {
    const product = await makeProductWithTieredPricing();

    const result = await searchProducts(product.name);

    expect(result.items.find((item) => item.id === product.id)?.price).toBe(500);
  });
});

describe("product.service.ts resolves an explicitly-passed customer group", () => {
  it("listProducts prices a Wholesale caller at the wholesale tier", async () => {
    const product = await makeProductWithTieredPricing();

    const result = await listProducts({ customerGroup: "Wholesale" });

    expect(result.items.find((item) => item.id === product.id)?.price).toBe(350);
  });

  it("getProductDetail prices a Wholesale caller at the wholesale tier", async () => {
    const product = await makeProductWithTieredPricing();

    const detail = await getProductDetail(product.slug, "Wholesale");

    expect(detail?.price).toBe(350);
  });

  it("getProductsByIds prices a Wholesale caller at the wholesale tier", async () => {
    const product = await makeProductWithTieredPricing();

    const items = await getProductsByIds([product.id], "Wholesale");

    expect(items[0]?.price).toBe(350);
  });

  it("getProductsForCompare prices a Wholesale caller at the wholesale tier", async () => {
    const product = await makeProductWithTieredPricing();

    const items = await getProductsForCompare([product.id], "Wholesale");

    expect(items[0]?.price).toBe(350);
  });

  it("all four default to the standard (Retail) tier with no customerGroup passed", async () => {
    const product = await makeProductWithTieredPricing();

    expect((await listProducts({})).items.find((item) => item.id === product.id)?.price).toBe(500);
    expect((await getProductDetail(product.slug))?.price).toBe(500);
    expect((await getProductsByIds([product.id]))[0]?.price).toBe(500);
    expect((await getProductsForCompare([product.id]))[0]?.price).toBe(500);
  });
});
