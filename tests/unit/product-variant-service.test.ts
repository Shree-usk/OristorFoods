// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createVariant, deleteVariant, updateVariant } from "@/services/product-admin.service";
import { ProductVariantHasOrdersError, ProductVariantSkuConflictError } from "@/services/product-admin.errors";
import { PermissionDeniedError } from "@/services/permission.errors";
import { ProductUnavailableError, StockExceededError } from "@/services/cart.errors";
import { requireAvailableVariant, resolveVariantPrice } from "@/services/product-variant.service";

const EMAIL_DOMAIN = "@product-variant-svc-test.test";
const ROLE_KEY_PREFIX = "product-variant-svc-test-role-";
const SKU_PREFIX = "product-variant-svc-test-sku-";
const VARIANT_SKU_PREFIX = "product-variant-svc-test-variant-sku-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Product Variant Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

function makeFullAccessAdmin() {
  return makeAdmin([
    { module: "Products", action: "View" },
    { module: "Products", action: "Edit" },
    { module: "Products", action: "Delete" },
  ]);
}

async function makeProduct() {
  sequence += 1;
  return createProduct({ sku: `${SKU_PREFIX}${sequence}`, slug: `product-variant-svc-test-${sequence}`, name: `Product Variant Svc Test Product ${sequence}`, status: "Published" });
}

function variantInput(overrides: Partial<Parameters<typeof createVariant>[2]> = {}) {
  sequence += 1;
  return {
    sku: `${VARIANT_SKU_PREFIX}${sequence}`,
    name: "100g",
    netWeightGrams: 100,
    price: 500,
    currency: "LKR",
    stockQuantity: 10,
    isActive: true,
    inStock: true,
    ...overrides,
  };
}

afterEach(async () => {
  await prisma.orderItem.deleteMany({ where: { productSku: { startsWith: SKU_PREFIX } } });
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: "product-variant-svc-test-order-" } } });
  await prisma.productVariant.deleteMany({ where: { sku: { startsWith: VARIANT_SKU_PREFIX } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("product-admin.service — variant CRUD", () => {
  it("creates, updates, and deletes a variant", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();

    const created = await createVariant(admin.id, product.id, variantInput());
    expect(created.name).toBe("100g");

    const updated = await updateVariant(admin.id, product.id, created.id, variantInput({ sku: created.sku, name: "100g (relabelled)" }));
    expect(updated.name).toBe("100g (relabelled)");

    await deleteVariant(admin.id, product.id, created.id);
    expect(await prisma.productVariant.findUnique({ where: { id: created.id } })).toBeNull();
  });

  it("allows two variants with a blank barcode — an empty string must become NULL, not collide on the unique index", async () => {
    // Matches the real admin form's payload shape exactly: the Barcode
    // input's controlled value is "" when left blank, never omitted —
    // a prior bug normalized `undefined`/`null` but not "", so a second
    // blank-barcode variant 500'd on a P2002 (caught live in the browser).
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();

    const first = await createVariant(admin.id, product.id, variantInput({ barcode: "" }));
    const second = await createVariant(admin.id, product.id, variantInput({ barcode: "" }));

    expect(first.barcode).toBeNull();
    expect(second.barcode).toBeNull();
  });

  it("rejects a duplicate variant SKU", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    const dupSku = `${VARIANT_SKU_PREFIX}dup-${sequence}`;
    await createVariant(admin.id, product.id, variantInput({ sku: dupSku }));

    await expect(createVariant(admin.id, product.id, variantInput({ sku: dupSku }))).rejects.toBeInstanceOf(ProductVariantSkuConflictError);
  });

  it("blocks deleting a variant that has been ordered — deactivate instead", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    const variant = await createVariant(admin.id, product.id, variantInput());

    sequence += 1;
    const order = await prisma.order.create({
      data: {
        orderNumber: `product-variant-svc-test-order-${sequence}`,
        idempotencyKey: `product-variant-svc-test-idem-${sequence}`,
        status: "Confirmed",
        subtotal: "500.00",
        deliveryCharge: "0.00",
        discount: "0.00",
        pointsRedeemed: 0,
        pointsRedemptionValue: "0.00",
        grandTotal: "500.00",
        deliveryZoneName: "Test Zone",
        shipRecipientName: "Test",
        shipPhone: "+94 77 000 0000",
        shipLine1: "1 Test Lane",
        shipCity: "Colombo",
        items: { create: [{ productId: product.id, variantId: variant.id, productName: product.name, productSku: product.sku, variantName: variant.name, variantSku: variant.sku, unitPrice: "500.00", quantity: 1, lineTotal: "500.00" }] },
      },
    });

    await expect(deleteVariant(admin.id, product.id, variant.id)).rejects.toBeInstanceOf(ProductVariantHasOrdersError);

    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
  });

  it("rejects a View-only admin's write but allows the read via the parent product fetch", async () => {
    const viewer = await makeAdmin([{ module: "Products", action: "View" }]);
    const product = await makeProduct();
    await expect(createVariant(viewer.id, product.id, variantInput())).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("product-variant.service — customer-facing availability/price resolution", () => {
  it("resolves a selected variant's price, preferring promoPrice when set", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    const variant = await createVariant(admin.id, product.id, variantInput({ price: 500, promoPrice: 400 }));

    expect(resolveVariantPrice(variant)).toEqual({ price: 400, currency: "LKR" });
  });

  it("allows an active, in-stock variant with enough stock", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    const variant = await createVariant(admin.id, product.id, variantInput({ stockQuantity: 5 }));

    const resolved = await requireAvailableVariant(variant.id, 3);
    expect(resolved.id).toBe(variant.id);
  });

  it("rejects an inactive variant", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    const variant = await createVariant(admin.id, product.id, variantInput({ isActive: false }));

    await expect(requireAvailableVariant(variant.id, 1)).rejects.toBeInstanceOf(ProductUnavailableError);
  });

  it("rejects an out-of-stock variant", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    const variant = await createVariant(admin.id, product.id, variantInput({ inStock: false }));

    await expect(requireAvailableVariant(variant.id, 1)).rejects.toBeInstanceOf(ProductUnavailableError);
  });

  it("rejects a quantity beyond available stock", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    const variant = await createVariant(admin.id, product.id, variantInput({ stockQuantity: 2 }));

    await expect(requireAvailableVariant(variant.id, 3)).rejects.toBeInstanceOf(StockExceededError);
  });
});
