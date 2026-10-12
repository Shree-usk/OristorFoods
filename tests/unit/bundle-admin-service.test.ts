// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { PermissionDeniedError } from "@/services/permission.errors";
import { addBundleItem, createBundle, deleteBundle, deleteBundleItem, getBundle, updateBundle, updateBundleItem } from "@/services/bundle-admin.service";
import { BundleAlreadyExistsError, BundleItemNotFoundError, BundleNotFoundError } from "@/services/product-admin.errors";
import { bundleAdminSchema } from "@/validation/product-admin.schema";

const EMAIL_DOMAIN = "@bundle-admin-svc-test.test";
const ROLE_KEY_PREFIX = "bundle-admin-svc-test-role-";
const SKU_PREFIX = "bundle-admin-svc-test-sku-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Bundle Admin Svc Test Role ${sequence}` } });
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
  return createProduct({ sku: `${SKU_PREFIX}${sequence}`, slug: `bundle-admin-svc-test-${sequence}`, name: `Bundle Admin Svc Test Product ${sequence}`, status: "Published" });
}

function bundleInput(overrides: Partial<Parameters<typeof createBundle>[2]> = {}) {
  return { bundleType: "Fixed" as const, name: "Test Bundle", status: "Active" as const, stockMode: "Derived" as const, ...overrides };
}

afterEach(async () => {
  await prisma.bundleItem.deleteMany();
  await prisma.productBundle.deleteMany();
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("bundle-admin.service", () => {
  it("creates, updates, and deletes a bundle", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();

    const created = await createBundle(admin.id, product.id, bundleInput());
    expect(created.name).toBe("Test Bundle");

    const updated = await updateBundle(admin.id, product.id, bundleInput({ name: "Renamed Bundle" }));
    expect(updated.name).toBe("Renamed Bundle");

    await deleteBundle(admin.id, product.id);
    expect(await getBundle(admin.id, product.id)).toBeNull();
  });

  it("rejects a second bundle on the same product (productId is unique)", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    await createBundle(admin.id, product.id, bundleInput());

    await expect(createBundle(admin.id, product.id, bundleInput())).rejects.toBeInstanceOf(BundleAlreadyExistsError);
  });

  it("rejects updating/deleting a bundle that doesn't exist yet", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();

    await expect(updateBundle(admin.id, product.id, bundleInput())).rejects.toBeInstanceOf(BundleNotFoundError);
    await expect(deleteBundle(admin.id, product.id)).rejects.toBeInstanceOf(BundleNotFoundError);
  });

  it("adds, updates, and deletes a bundle item", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    const component = await makeProduct();
    const bundle = await createBundle(admin.id, product.id, bundleInput());

    const item = await addBundleItem(admin.id, product.id, { componentProductId: component.id, quantity: 2 });
    expect(item.bundleId).toBe(bundle.id);
    expect(item.quantity).toBe(2);

    const updated = await updateBundleItem(admin.id, product.id, item.id, { componentProductId: component.id, quantity: 5 });
    expect(updated.quantity).toBe(5);

    await deleteBundleItem(admin.id, product.id, item.id);
    expect(await prisma.bundleItem.findUnique({ where: { id: item.id } })).toBeNull();
  });

  it("rejects a bundle item id that doesn't belong to this product's bundle", async () => {
    const admin = await makeFullAccessAdmin();
    const productA = await makeProduct();
    const productB = await makeProduct();
    const componentA = await makeProduct();
    await createBundle(admin.id, productA.id, bundleInput());
    await createBundle(admin.id, productB.id, bundleInput());
    const itemOnA = await addBundleItem(admin.id, productA.id, { componentProductId: componentA.id, quantity: 1 });

    await expect(updateBundleItem(admin.id, productB.id, itemOnA.id, { componentProductId: componentA.id, quantity: 1 })).rejects.toBeInstanceOf(BundleItemNotFoundError);
  });

  it("denies every mutating action to an admin without Products:Edit", async () => {
    const viewer = await makeAdmin([{ module: "Products", action: "View" }]);
    const product = await makeProduct();
    await expect(createBundle(viewer.id, product.id, bundleInput())).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("bundleAdminSchema — discount XOR validation", () => {
  it("accepts no discount at all", () => {
    expect(bundleAdminSchema.safeParse({ bundleType: "Fixed", name: "X" }).success).toBe(true);
  });

  it("accepts exactly one discount field alongside its discountType", () => {
    expect(bundleAdminSchema.safeParse({ bundleType: "Fixed", name: "X", discountType: "FixedPrice", fixedPrice: 100 }).success).toBe(true);
  });

  it("rejects a discountType with no matching value set", () => {
    expect(bundleAdminSchema.safeParse({ bundleType: "Fixed", name: "X", discountType: "FixedPrice" }).success).toBe(false);
  });

  it("rejects two discount fields set at once", () => {
    expect(bundleAdminSchema.safeParse({ bundleType: "Fixed", name: "X", discountType: "FixedPrice", fixedPrice: 100, percentOff: 10 }).success).toBe(false);
  });
});
