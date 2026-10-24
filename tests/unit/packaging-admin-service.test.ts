// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { PermissionDeniedError } from "@/services/permission.errors";
import {
  createPackagingMethod,
  createPackagingOption,
  deletePackagingOption,
  listPackagingMethods,
  listPackagingOptionsForProduct,
  updatePackagingMethod,
  updatePackagingOption,
} from "@/services/packaging-admin.service";
import {
  PackagingMethodNameConflictError,
  PackagingMethodNotFoundError,
  PackagingOptionDuplicateError,
  PackagingOptionNotFoundError,
  PackagingOptionRequiresVariantsError,
  PackagingOptionVariantMismatchError,
} from "@/services/product-admin.errors";
import { productPackagingOptionAdminSchema } from "@/validation/packaging-admin.schema";

const EMAIL_DOMAIN = "@packaging-admin-svc-test.test";
const ROLE_KEY_PREFIX = "packaging-admin-svc-test-role-";
const SKU_PREFIX = "packaging-admin-svc-test-sku-";
const METHOD_NAME_PREFIX = "Packaging Admin Svc Test Method ";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Packaging Admin Svc Test Role ${sequence}` } });
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
  return createProduct({ sku: `${SKU_PREFIX}${sequence}`, slug: `packaging-admin-svc-test-${sequence}`, name: `Packaging Admin Svc Test Product ${sequence}`, status: "Published" });
}

async function makeVariant(productId: string) {
  sequence += 1;
  return prisma.productVariant.create({
    data: { productId, sku: `${SKU_PREFIX}variant-${sequence}`, name: `Variant ${sequence}`, netWeightGrams: 100, price: "100.00", currency: "LKR", stockQuantity: 10, inStock: true, isActive: true },
  });
}

async function makeMethod(adminId: string) {
  sequence += 1;
  return createPackagingMethod(adminId, { name: `${METHOD_NAME_PREFIX}${sequence}` });
}

afterEach(async () => {
  await prisma.productPackagingOption.deleteMany();
  await prisma.packagingMethod.deleteMany({ where: { name: { startsWith: METHOD_NAME_PREFIX } } });
  await prisma.productVariant.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("packaging-admin.service — PackagingMethod", () => {
  it("creates and updates a packaging method", async () => {
    const admin = await makeFullAccessAdmin();
    const method = await makeMethod(admin.id);
    expect(method.status).toBe("Active");

    const updated = await updatePackagingMethod(admin.id, method.id, { name: method.name, status: "Inactive" });
    expect(updated.status).toBe("Inactive");
  });

  it("rejects a duplicate method name", async () => {
    const admin = await makeFullAccessAdmin();
    const method = await makeMethod(admin.id);
    await expect(createPackagingMethod(admin.id, { name: method.name })).rejects.toBeInstanceOf(PackagingMethodNameConflictError);
  });

  it("allows renaming a method to its own current name (no false-positive conflict)", async () => {
    const admin = await makeFullAccessAdmin();
    const method = await makeMethod(admin.id);
    await expect(updatePackagingMethod(admin.id, method.id, { name: method.name })).resolves.toMatchObject({ id: method.id });
  });

  it("rejects updating a method that doesn't exist", async () => {
    const admin = await makeFullAccessAdmin();
    await expect(updatePackagingMethod(admin.id, "does-not-exist", { name: "X" })).rejects.toBeInstanceOf(PackagingMethodNotFoundError);
  });

  it("denies creating a method to an admin without Products:Edit", async () => {
    const viewer = await makeAdmin([{ module: "Products", action: "View" }]);
    await expect(createPackagingMethod(viewer.id, { name: "Should Not Be Created" })).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("lists methods only for an admin with Products:View", async () => {
    const noAccess = await makeAdmin([]);
    await expect(listPackagingMethods(noAccess.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("packaging-admin.service — ProductPackagingOption", () => {
  it("creates, updates, and deletes a packaging option", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    const method = await makeMethod(admin.id);

    const created = await createPackagingOption(admin.id, product.id, { packagingMethodId: method.id, charge: 150 });
    expect(created.productId).toBe(product.id);
    expect(created.charge.toString()).toBe("150");

    const updated = await updatePackagingOption(admin.id, product.id, created.id, { packagingMethodId: method.id, charge: 200, requiresManualReview: true });
    expect(updated.charge.toString()).toBe("200");
    expect(updated.requiresManualReview).toBe(true);

    await deletePackagingOption(admin.id, product.id, created.id);
    expect(await prisma.productPackagingOption.findUnique({ where: { id: created.id } })).toBeNull();
  });

  it("accepts a variant pin belonging to the same product", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    const variant = await makeVariant(product.id);
    const method = await makeMethod(admin.id);

    const option = await createPackagingOption(admin.id, product.id, { packagingMethodId: method.id, variantId: variant.id });
    expect(option.variantId).toBe(variant.id);
  });

  it("rejects a variant pin belonging to a different product", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    const otherProduct = await makeProduct();
    const otherVariant = await makeVariant(otherProduct.id);
    const method = await makeMethod(admin.id);

    await expect(createPackagingOption(admin.id, product.id, { packagingMethodId: method.id, variantId: otherVariant.id })).rejects.toBeInstanceOf(PackagingOptionVariantMismatchError);
  });

  it("rejects a duplicate (product, variant, method) combination — app-level guard, not a DB constraint (Postgres NULL<>NULL)", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    const method = await makeMethod(admin.id);
    await createPackagingOption(admin.id, product.id, { packagingMethodId: method.id });

    await expect(createPackagingOption(admin.id, product.id, { packagingMethodId: method.id })).rejects.toBeInstanceOf(PackagingOptionDuplicateError);
  });

  it("allows the same method twice on one product when scoped to different variants", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    const variantA = await makeVariant(product.id);
    const variantB = await makeVariant(product.id);
    const method = await makeMethod(admin.id);

    await createPackagingOption(admin.id, product.id, { packagingMethodId: method.id, variantId: variantA.id });
    await expect(createPackagingOption(admin.id, product.id, { packagingMethodId: method.id, variantId: variantB.id })).resolves.toMatchObject({ variantId: variantB.id });
  });

  it("rejects updating/deleting an option that doesn't belong to this product", async () => {
    const admin = await makeFullAccessAdmin();
    const productA = await makeProduct();
    const productB = await makeProduct();
    const method = await makeMethod(admin.id);
    const option = await createPackagingOption(admin.id, productA.id, { packagingMethodId: method.id });

    await expect(updatePackagingOption(admin.id, productB.id, option.id, { packagingMethodId: method.id })).rejects.toBeInstanceOf(PackagingOptionNotFoundError);
    await expect(deletePackagingOption(admin.id, productB.id, option.id)).rejects.toBeInstanceOf(PackagingOptionNotFoundError);
  });

  it("denies every mutating action to an admin without Products:Edit/Delete", async () => {
    const viewer = await makeAdmin([{ module: "Products", action: "View" }]);
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    const method = await makeMethod(admin.id);

    await expect(createPackagingOption(viewer.id, product.id, { packagingMethodId: method.id })).rejects.toBeInstanceOf(PermissionDeniedError);

    const option = await createPackagingOption(admin.id, product.id, { packagingMethodId: method.id });
    await expect(deletePackagingOption(viewer.id, product.id, option.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("lists options for a product", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    const method = await makeMethod(admin.id);
    await createPackagingOption(admin.id, product.id, { packagingMethodId: method.id });

    const options = await listPackagingOptionsForProduct(admin.id, product.id);
    expect(options).toHaveLength(1);
  });
});

describe("packaging-admin.service — weight-based (PerGram) pricing (Story 3b)", () => {
  it("creates a PerGram option with a positive rate", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    await makeVariant(product.id);
    const method = await makeMethod(admin.id);

    const option = await createPackagingOption(admin.id, product.id, { packagingMethodId: method.id, chargeType: "PerGram", ratePerGram: 0.5 });
    expect(option.chargeType).toBe("PerGram");
    expect(option.ratePerGram?.toString()).toBe("0.5");
  });

  it("rejects PerGram on a product with no variants", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    const method = await makeMethod(admin.id);

    await expect(createPackagingOption(admin.id, product.id, { packagingMethodId: method.id, chargeType: "PerGram", ratePerGram: 0.5 })).rejects.toBeInstanceOf(
      PackagingOptionRequiresVariantsError,
    );
  });

  it("rejects PerGram without a positive rate at the validation layer", () => {
    const parsed = productPackagingOptionAdminSchema.safeParse({ packagingMethodId: "method-1", chargeType: "PerGram" });
    expect(parsed.success).toBe(false);
  });

  it("nulls out the inactive mode's fields when switching an option from PerGram back to Fixed", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    await makeVariant(product.id);
    const method = await makeMethod(admin.id);
    const option = await createPackagingOption(admin.id, product.id, {
      packagingMethodId: method.id,
      chargeType: "PerGram",
      ratePerGram: 0.5,
      minOrderWeightGrams: 1000,
      minPackagingCharge: 100,
    });

    const updated = await updatePackagingOption(admin.id, product.id, option.id, { packagingMethodId: method.id, chargeType: "Fixed", charge: 150 });
    expect(updated.chargeType).toBe("Fixed");
    expect(updated.ratePerGram).toBeNull();
    expect(updated.minOrderWeightGrams).toBeNull();
    expect(updated.minPackagingCharge).toBeNull();
  });
});
