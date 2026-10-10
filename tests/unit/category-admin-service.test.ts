// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { PermissionDeniedError } from "@/services/permission.errors";
import { CategoryNotFoundError, CategoryParentCycleError, CategorySlugConflictError } from "@/services/category.errors";
import {
  createCategoryAdmin,
  getFeaturedCategoriesForStorefront,
  listCategoriesForAdmin,
  updateCategoryAdmin,
} from "@/services/category.service";

const EMAIL_DOMAIN = "@category-svc-test.test";
const ROLE_KEY_PREFIX = "category-svc-test-role-";
const SLUG_PREFIX = "category-svc-test-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Category Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

function makeFullAccessAdmin() {
  return makeAdmin([
    { module: "Products", action: "View" },
    { module: "Products", action: "Edit" },
  ]);
}

function slug(name: string) {
  sequence += 1;
  return `${SLUG_PREFIX}${name}-${sequence}`;
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("category.service — permissions", () => {
  it("a View-only admin can list but not create or update", async () => {
    const viewer = await makeAdmin([{ module: "Products", action: "View" }]);
    await expect(listCategoriesForAdmin(viewer.id)).resolves.toBeInstanceOf(Array);
    await expect(createCategoryAdmin(viewer.id, { name: "x", slug: slug("x") })).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("an admin with no Products grant at all is rejected even for the read", async () => {
    const noAccess = await makeAdmin([]);
    await expect(listCategoriesForAdmin(noAccess.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("category.service — create/update", () => {
  it("creates a category, assigns the next root sortOrder, and audit-logs it", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await createCategoryAdmin(admin.id, { name: "Chili Pastes", slug: slug("chili-pastes") });
    expect(category.sortOrder).toBeGreaterThanOrEqual(0);

    const logCount = await prisma.auditLog.count({ where: { actorId: admin.id, action: "category_created" } });
    expect(logCount).toBe(1);
  });

  it("rejects a duplicate slug on create and on update", async () => {
    const admin = await makeFullAccessAdmin();
    const dupSlug = slug("dup");
    await createCategoryAdmin(admin.id, { name: "First", slug: dupSlug });
    await expect(createCategoryAdmin(admin.id, { name: "Second", slug: dupSlug })).rejects.toBeInstanceOf(CategorySlugConflictError);

    const other = await createCategoryAdmin(admin.id, { name: "Other", slug: slug("other") });
    await expect(updateCategoryAdmin(admin.id, other.id, { slug: dupSlug })).rejects.toBeInstanceOf(CategorySlugConflictError);
  });

  it("allows updating a category's own slug to the same value it already has", async () => {
    const admin = await makeFullAccessAdmin();
    const own = slug("own");
    const category = await createCategoryAdmin(admin.id, { name: "Self", slug: own });
    await expect(updateCategoryAdmin(admin.id, category.id, { slug: own, name: "Self Renamed" })).resolves.toMatchObject({ name: "Self Renamed" });
  });

  it("throws CategoryNotFoundError updating a category that doesn't exist", async () => {
    const admin = await makeFullAccessAdmin();
    await expect(updateCategoryAdmin(admin.id, "does-not-exist", { name: "x" })).rejects.toBeInstanceOf(CategoryNotFoundError);
  });

  it("rejects setting a category's parent to its own descendant (cycle)", async () => {
    const admin = await makeFullAccessAdmin();
    const parent = await createCategoryAdmin(admin.id, { name: "Parent", slug: slug("parent") });
    const child = await createCategoryAdmin(admin.id, { name: "Child", slug: slug("child"), parentId: parent.id });

    await expect(updateCategoryAdmin(admin.id, parent.id, { parentId: child.id })).rejects.toBeInstanceOf(CategoryParentCycleError);
    await expect(updateCategoryAdmin(admin.id, parent.id, { parentId: parent.id })).rejects.toBeInstanceOf(CategoryParentCycleError);
  });

  it("clears a blank string field back to null rather than storing empty text", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await createCategoryAdmin(admin.id, { name: "Blank Fields", slug: slug("blank"), image: "/media-files/x.jpg" });
    const updated = await updateCategoryAdmin(admin.id, category.id, { image: "" });
    expect(updated.image).toBeNull();
  });
});

describe("category.service — storefront featured list", () => {
  it("only returns Active categories that have an image set", async () => {
    const admin = await makeFullAccessAdmin();
    const noImage = await createCategoryAdmin(admin.id, { name: "No Image", slug: slug("no-image"), status: "Active" });
    const inactive = await createCategoryAdmin(admin.id, { name: "Inactive", slug: slug("inactive"), status: "Inactive", image: "/media-files/x.jpg" });
    const featured = await createCategoryAdmin(admin.id, { name: "Featured", slug: slug("featured"), status: "Active", image: "/media-files/x.jpg" });

    const result = await getFeaturedCategoriesForStorefront(10);
    const ids = result.map((category) => category.id);
    expect(ids).toContain(featured.id);
    expect(ids).not.toContain(noImage.id);
    expect(ids).not.toContain(inactive.id);
  });
});
