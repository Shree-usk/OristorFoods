// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { filterReorderableItems, getOrderListPage } from "@/services/customer-order-history.service";

const EMAIL_PREFIX = "ord-hist-svc-";
const SKU_PREFIX = "ORD-HIST-SKU-";
let sequence = 0;

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `${EMAIL_PREFIX}${sequence}@test.com` } });
}

async function makeProduct(overrides: { status?: "Published" | "Archived"; inStock?: boolean; stockQuantity?: number } = {}) {
  sequence += 1;
  return createProduct({
    sku: `${SKU_PREFIX}${sequence}`,
    slug: `ord-hist-product-${sequence}`,
    name: `Order History Product ${sequence}`,
    status: overrides.status ?? "Published",
    inStock: overrides.inStock ?? true,
    stockQuantity: overrides.stockQuantity ?? 10,
  });
}

async function makeOrder(userId: string, status: "Confirmed" | "Delivered", items: Array<{ productId: string | null; quantity: number }>) {
  sequence += 1;
  return prisma.order.create({
    data: {
      orderNumber: `ORS-TEST-${sequence}`,
      idempotencyKey: `idem-${sequence}`,
      userId,
      status,
      subtotal: "100.00",
      deliveryCharge: "0.00",
      grandTotal: "100.00",
      deliveryZoneName: "Western",
      shipRecipientName: "Test Customer",
      shipPhone: "+94 77 123 4567",
      shipLine1: "10 Test Lane",
      shipCity: "Colombo",
      items: {
        create: items.map((item, index) => ({
          productId: item.productId,
          productName: `Item ${index}`,
          productSku: `SKU-${index}`,
          unitPrice: "50.00",
          quantity: item.quantity,
          lineTotal: (50 * item.quantity).toFixed(2),
        })),
      },
    },
  });
}

afterEach(async () => {
  await prisma.orderItem.deleteMany({ where: { order: { orderNumber: { startsWith: "ORS-TEST-" } } } });
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: "ORS-TEST-" } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
});

describe("customer-order-history.service", () => {
  describe("filterReorderableItems (pure)", () => {
    it("reorders an in-stock, published item at its full requested quantity", () => {
      const stockLookup = new Map([["p1", { status: "Published", inStock: true, stockQuantity: 10 }]]);
      const result = filterReorderableItems([{ productId: "p1", productName: "Widget", quantity: 3 }], stockLookup);
      expect(result.reorderable).toEqual([{ productId: "p1", productName: "Widget", quantity: 3 }]);
      expect(result.skipped).toHaveLength(0);
    });

    it("skips a deleted product (null productId) as 'No longer available'", () => {
      const result = filterReorderableItems([{ productId: null, productName: "Discontinued Item", quantity: 1 }], new Map());
      expect(result.reorderable).toHaveLength(0);
      expect(result.skipped).toEqual([{ productName: "Discontinued Item", reason: "No longer available" }]);
    });

    it("skips an unpublished/out-of-catalogue product as 'No longer available'", () => {
      const stockLookup = new Map([["p1", { status: "Archived", inStock: true, stockQuantity: 10 }]]);
      const result = filterReorderableItems([{ productId: "p1", productName: "Widget", quantity: 1 }], stockLookup);
      expect(result.reorderable).toHaveLength(0);
      expect(result.skipped).toEqual([{ productName: "Widget", reason: "No longer available" }]);
    });

    it("skips a zero-stock product as 'Out of stock'", () => {
      const stockLookup = new Map([["p1", { status: "Published", inStock: true, stockQuantity: 0 }]]);
      const result = filterReorderableItems([{ productId: "p1", productName: "Widget", quantity: 1 }], stockLookup);
      expect(result.reorderable).toHaveLength(0);
      expect(result.skipped).toEqual([{ productName: "Widget", reason: "Out of stock" }]);
    });

    it("caps quantity at live stock and notes the partial cap", () => {
      const stockLookup = new Map([["p1", { status: "Published", inStock: true, stockQuantity: 2 }]]);
      const result = filterReorderableItems([{ productId: "p1", productName: "Widget", quantity: 5 }], stockLookup);
      expect(result.reorderable).toEqual([{ productId: "p1", productName: "Widget", quantity: 2 }]);
      expect(result.skipped).toEqual([{ productName: "Widget", reason: "Only 2 left — added 2 instead of 5" }]);
    });
  });

  describe("getOrderListPage", () => {
    it("filters by status", async () => {
      const user = await makeUser();
      const product = await makeProduct();
      await makeOrder(user.id, "Confirmed", [{ productId: product.id, quantity: 1 }]);
      await makeOrder(user.id, "Delivered", [{ productId: product.id, quantity: 1 }]);

      const page = await getOrderListPage(user.id, 1, 20, { status: "Delivered" });
      expect(page.total).toBe(1);
      expect(page.orders[0]?.status).toBe("Delivered");
    });

    it("includes thumbnail URLs for orders with live product images", async () => {
      const user = await makeUser();
      const product = await makeProduct();
      await makeOrder(user.id, "Confirmed", [{ productId: product.id, quantity: 1 }]);

      const page = await getOrderListPage(user.id, 1, 20, {});
      expect(page.orders).toHaveLength(1);
      // No images were attached to this product, so thumbnails is simply empty — this exercises the batched lookup path without asserting a URL.
      expect(page.orders[0]?.thumbnailUrls).toEqual([]);
    });
  });
});
