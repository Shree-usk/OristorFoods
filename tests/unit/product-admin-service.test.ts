// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { PermissionDeniedError } from "@/services/permission.errors";
import {
  ProductAdminIllegalTransitionError,
  ProductAdminNotFoundError,
  ProductAdminSkuConflictError,
  ProductAdminSlugConflictError,
} from "@/services/product-admin.errors";
import {
  bulkChangeStatus,
  changeProductStatus,
  createProduct,
  deleteProduct,
  duplicateProduct,
  getProductForAdmin,
  setCustomerGroupPrice,
  setStandardPrice,
  updateProduct,
  upsertSalePrice,
  type ProductAdminInput,
} from "@/services/product-admin.service";

const EMAIL_DOMAIN = "@product-admin-svc-test.test";
const ROLE_KEY_PREFIX = "product-admin-svc-test-role-";
const SKU_PREFIX = "PROD-ADMIN-SVC-";
let sequence = 0;

async function makeRole(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Product Admin Svc Test Role ${sequence}` } });
  await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return role;
}

async function makeAdminUser(roleId: string) {
  sequence += 1;
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId } });
}

async function makeFullAccessAdmin() {
  const role = await makeRole([
    { module: "Products", action: "View" },
    { module: "Products", action: "Edit" },
    { module: "Products", action: "Delete" },
  ]);
  return makeAdminUser(role.id);
}

async function makeCategory() {
  sequence += 1;
  return prisma.category.create({ data: { name: `Test Category ${sequence}`, slug: `product-admin-svc-category-${sequence}` } });
}

function baseInput(overrides: Partial<ProductAdminInput> = {}): ProductAdminInput {
  sequence += 1;
  return {
    name: `Test Product ${sequence}`,
    slug: `product-admin-svc-${sequence}`,
    sku: `${SKU_PREFIX}${sequence}`,
    categoryIds: [],
    images: [{ url: "https://example.com/image.jpg", altText: "A product" }],
    videos: [],
    nutrition: {
      servingSize: "100g",
      calories: 100,
      protein: 5,
      fat: 2,
      saturatedFat: 1,
      carbohydrates: 10,
      sugar: 3,
      fibre: 1,
      sodium: 50,
    },
    ingredients: [{ name: "Sugar" }, { name: "Salt" }],
    ...overrides,
  };
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: "product-admin-svc-category-" } } });
});

describe("product-admin.service", () => {
  it("creates a product persisting every field group", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await makeCategory();

    const created = await createProduct(admin.id, baseInput({ categoryIds: [category.id] }));

    expect(created.status).toBe("Draft");
    expect(created.images).toHaveLength(1);
    expect(created.ingredients.map((i) => i.name).sort()).toEqual(["Salt", "Sugar"]);
    expect(created.categories.map((c) => c.id)).toEqual([category.id]);
    expect(created.nutrition?.calories.toString()).toBe("100");
    expect(created.createdById).toBe(admin.id);
    expect(created.updatedById).toBe(admin.id);
  });

  it("rejects a duplicate slug and a duplicate SKU with distinct error classes", async () => {
    const admin = await makeFullAccessAdmin();
    const first = baseInput();
    await createProduct(admin.id, first);

    await expect(createProduct(admin.id, baseInput({ slug: first.slug }))).rejects.toBeInstanceOf(ProductAdminSlugConflictError);
    await expect(createProduct(admin.id, baseInput({ sku: first.sku }))).rejects.toBeInstanceOf(ProductAdminSkuConflictError);
  });

  it("updateProduct wholesale-replaces images/videos/ingredients", async () => {
    const admin = await makeFullAccessAdmin();
    const created = await createProduct(admin.id, baseInput());

    const updated = await updateProduct(admin.id, created.id, {
      ...baseInput({ slug: created.slug, sku: created.sku }),
      images: [{ url: "https://example.com/new.jpg" }],
      ingredients: [{ name: "Water" }],
    });

    expect(updated.images.map((i) => i.url)).toEqual(["https://example.com/new.jpg"]);
    expect(updated.ingredients.map((i) => i.name)).toEqual(["Water"]);
  });

  it("duplicateProduct forces a caller-supplied slug/SKU, copies content, and never copies pricing", async () => {
    const admin = await makeFullAccessAdmin();
    const source = await createProduct(admin.id, baseInput());
    await setStandardPrice(admin.id, source.id, 500, "LKR");

    sequence += 1;
    const duplicate = await duplicateProduct(admin.id, source.id, `product-admin-svc-dup-${sequence}`, `${SKU_PREFIX}DUP-${sequence}`);

    expect(duplicate.slug).toBe(`product-admin-svc-dup-${sequence}`);
    expect(duplicate.sku).toBe(`${SKU_PREFIX}DUP-${sequence}`);
    expect(duplicate.status).toBe("Draft");
    expect(duplicate.ingredients.map((i) => i.name).sort()).toEqual(["Salt", "Sugar"]);
    expect(duplicate.standardPrices).toHaveLength(0);
  });

  it("enforces the Draft/Published/Archived transition whitelist", async () => {
    const admin = await makeFullAccessAdmin();
    const created = await createProduct(admin.id, baseInput());

    const published = await changeProductStatus(admin.id, created.id, "Published");
    expect(published.status).toBe("Published");
    expect(published.publishedAt).not.toBeNull();

    await expect(changeProductStatus(admin.id, created.id, "Draft")).rejects.toBeInstanceOf(ProductAdminIllegalTransitionError);

    const archived = await changeProductStatus(admin.id, created.id, "Archived");
    expect(archived.status).toBe("Archived");

    const reopened = await changeProductStatus(admin.id, created.id, "Draft");
    expect(reopened.status).toBe("Draft");
  });

  it("bulkChangeStatus reports per-id success/failure instead of aborting the whole batch", async () => {
    const admin = await makeFullAccessAdmin();
    // a: Draft -> Published is a legal transition, so this one succeeds.
    const a = await createProduct(admin.id, baseInput());
    // b: already Published — Published -> Published isn't in the whitelist
    // (only Published -> Archived is), so this one is an illegal transition.
    const b = await createProduct(admin.id, baseInput());
    await changeProductStatus(admin.id, b.id, "Published");

    const result = await bulkChangeStatus(admin.id, [a.id, b.id, "nonexistent-id"], "Published");

    expect(result.succeeded).toEqual([a.id]);
    expect(result.failed).toEqual(
      expect.arrayContaining([
        { id: b.id, reason: "illegal_transition" },
        { id: "nonexistent-id", reason: "not_found" },
      ]),
    );
    expect(result.failed).toHaveLength(2);
  });

  it("deleteProduct removes the row and requires Products:Delete", async () => {
    const admin = await makeFullAccessAdmin();
    const created = await createProduct(admin.id, baseInput());

    await deleteProduct(admin.id, created.id);
    await expect(getProductForAdmin(admin.id, created.id)).rejects.toBeInstanceOf(ProductAdminNotFoundError);
  });

  it("denies every mutating action to an admin without Products:Edit", async () => {
    const viewOnlyRole = await makeRole([{ module: "Products", action: "View" }]);
    const viewer = await makeAdminUser(viewOnlyRole.id);

    await expect(createProduct(viewer.id, baseInput())).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("pricing: setStandardPrice always appends, upsertSalePrice creates then updates the same row", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await createProduct(admin.id, baseInput());

    await setStandardPrice(admin.id, product.id, 100, "LKR");
    await setStandardPrice(admin.id, product.id, 120, "LKR");
    const afterTwoSets = await getProductForAdmin(admin.id, product.id);
    expect(afterTwoSets.standardPrices[0].price.toString()).toBe("120");

    const created = await upsertSalePrice(admin.id, product.id, null, {
      price: 80,
      currency: "LKR",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-01-31"),
    });
    const updated = await upsertSalePrice(admin.id, product.id, created.id, {
      price: 70,
      currency: "LKR",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-01-31"),
    });
    expect(updated.id).toBe(created.id);
    expect(updated.price.toString()).toBe("70");
  });

  it("pricing: setCustomerGroupPrice upserts (unique per productId+customerGroup)", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await createProduct(admin.id, baseInput());

    await setCustomerGroupPrice(admin.id, product.id, "Wholesale", 90, "LKR");
    await setCustomerGroupPrice(admin.id, product.id, "Wholesale", 85, "LKR");

    const detail = await getProductForAdmin(admin.id, product.id);
    const wholesaleRows = detail.customerGroupPrices.filter((row) => row.customerGroup === "Wholesale");
    expect(wholesaleRows).toHaveLength(1);
    expect(wholesaleRows[0].price.toString()).toBe("85");
  });
});
