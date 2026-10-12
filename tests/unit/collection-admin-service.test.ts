// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { PermissionDeniedError } from "@/services/permission.errors";
import { CollectionNotFoundError, CollectionSlugConflictError } from "@/services/collection.errors";
import {
  createCollectionAdmin,
  getFeaturedCollectionsForStorefront,
  listCollectionsForAdmin,
  updateCollectionAdmin,
} from "@/services/collection.service";

const EMAIL_DOMAIN = "@collection-svc-test.test";
const ROLE_KEY_PREFIX = "collection-svc-test-role-";
const SLUG_PREFIX = "collection-svc-test-";
const PRODUCT_SKU_PREFIX = "collection-svc-test-product-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Collection Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

async function makeProduct() {
  sequence += 1;
  return prisma.product.create({
    data: { sku: `${PRODUCT_SKU_PREFIX}${sequence}`, slug: `${PRODUCT_SKU_PREFIX}${sequence}`, name: `Collection Svc Test Product ${sequence}`, status: "Published" },
  });
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
  await prisma.collection.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: PRODUCT_SKU_PREFIX } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("collection.service — permissions", () => {
  it("a View-only admin can list but not create or update", async () => {
    const viewer = await makeAdmin([{ module: "Products", action: "View" }]);
    await expect(listCollectionsForAdmin(viewer.id)).resolves.toBeInstanceOf(Array);
    await expect(createCollectionAdmin(viewer.id, { name: "x", slug: slug("x") })).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("an admin with no Products grant at all is rejected even for the read", async () => {
    const noAccess = await makeAdmin([]);
    await expect(listCollectionsForAdmin(noAccess.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("collection.service — create/update", () => {
  it("creates a collection and audit-logs it", async () => {
    const admin = await makeFullAccessAdmin();
    const collection = await createCollectionAdmin(admin.id, { name: "Festive Gifts", slug: slug("festive-gifts") });
    expect(collection.status).toBe("Active");

    const logCount = await prisma.auditLog.count({ where: { actorId: admin.id, action: "collection_created" } });
    expect(logCount).toBe(1);
  });

  it("rejects a duplicate slug on create and on update", async () => {
    const admin = await makeFullAccessAdmin();
    const dupSlug = slug("dup");
    await createCollectionAdmin(admin.id, { name: "First", slug: dupSlug });
    await expect(createCollectionAdmin(admin.id, { name: "Second", slug: dupSlug })).rejects.toBeInstanceOf(CollectionSlugConflictError);

    const other = await createCollectionAdmin(admin.id, { name: "Other", slug: slug("other") });
    await expect(updateCollectionAdmin(admin.id, other.id, { slug: dupSlug })).rejects.toBeInstanceOf(CollectionSlugConflictError);
  });

  it("allows updating a collection's own slug to the same value it already has", async () => {
    const admin = await makeFullAccessAdmin();
    const own = slug("own");
    const collection = await createCollectionAdmin(admin.id, { name: "Self", slug: own });
    await expect(updateCollectionAdmin(admin.id, collection.id, { slug: own, name: "Self Renamed" })).resolves.toMatchObject({ name: "Self Renamed" });
  });

  it("throws CollectionNotFoundError updating a collection that doesn't exist", async () => {
    const admin = await makeFullAccessAdmin();
    await expect(updateCollectionAdmin(admin.id, "does-not-exist", { name: "x" })).rejects.toBeInstanceOf(CollectionNotFoundError);
  });

  it("clears a blank string field back to null rather than storing empty text", async () => {
    const admin = await makeFullAccessAdmin();
    const collection = await createCollectionAdmin(admin.id, { name: "Blank Fields", slug: slug("blank"), image: "/media-files/x.jpg" });
    const updated = await updateCollectionAdmin(admin.id, collection.id, { image: "" });
    expect(updated.image).toBeNull();
  });

  it("parses a date <input> string into a real Date, and a blank one back to null", async () => {
    const admin = await makeFullAccessAdmin();
    const collection = await createCollectionAdmin(admin.id, { name: "Dated", slug: slug("dated"), startDate: "2026-04-01" });
    expect(collection.startDate).toEqual(new Date("2026-04-01"));

    const cleared = await updateCollectionAdmin(admin.id, collection.id, { startDate: "" });
    expect(cleared.startDate).toBeNull();
  });
});

describe("collection.service — product curation", () => {
  it("connects the given products on create", async () => {
    const admin = await makeFullAccessAdmin();
    const productA = await makeProduct();
    const productB = await makeProduct();

    const collection = await createCollectionAdmin(admin.id, { name: "Gift Set", slug: slug("gift-set"), productIds: [productA.id, productB.id] });

    const [listed] = (await listCollectionsForAdmin(admin.id)).filter((c) => c.id === collection.id);
    expect(listed.products.map((p) => p.id).sort()).toEqual([productA.id, productB.id].sort());
  });

  it("replaces (not merges) the product set on update", async () => {
    const admin = await makeFullAccessAdmin();
    const productA = await makeProduct();
    const productB = await makeProduct();
    const collection = await createCollectionAdmin(admin.id, { name: "Gift Set", slug: slug("gift-set"), productIds: [productA.id] });

    await updateCollectionAdmin(admin.id, collection.id, { productIds: [productB.id] });

    const [listed] = (await listCollectionsForAdmin(admin.id)).filter((c) => c.id === collection.id);
    expect(listed.products.map((p) => p.id)).toEqual([productB.id]);
  });

  it("leaves existing products untouched when productIds is omitted from the update", async () => {
    const admin = await makeFullAccessAdmin();
    const productA = await makeProduct();
    const collection = await createCollectionAdmin(admin.id, { name: "Gift Set", slug: slug("gift-set"), productIds: [productA.id] });

    await updateCollectionAdmin(admin.id, collection.id, { name: "Gift Set Renamed" });

    const [listed] = (await listCollectionsForAdmin(admin.id)).filter((c) => c.id === collection.id);
    expect(listed.products.map((p) => p.id)).toEqual([productA.id]);
  });

  it("clears all products when productIds is an empty array", async () => {
    const admin = await makeFullAccessAdmin();
    const productA = await makeProduct();
    const collection = await createCollectionAdmin(admin.id, { name: "Gift Set", slug: slug("gift-set"), productIds: [productA.id] });

    await updateCollectionAdmin(admin.id, collection.id, { productIds: [] });

    const [listed] = (await listCollectionsForAdmin(admin.id)).filter((c) => c.id === collection.id);
    expect(listed.products).toEqual([]);
  });
});

describe("collection.service — storefront featured list", () => {
  it("only returns Active collections that have an image set", async () => {
    const admin = await makeFullAccessAdmin();
    const noImage = await createCollectionAdmin(admin.id, { name: "No Image", slug: slug("no-image"), status: "Active" });
    const inactive = await createCollectionAdmin(admin.id, { name: "Inactive", slug: slug("inactive"), status: "Inactive", image: "/media-files/x.jpg" });
    const featured = await createCollectionAdmin(admin.id, { name: "Featured", slug: slug("featured"), status: "Active", image: "/media-files/x.jpg" });

    const result = await getFeaturedCollectionsForStorefront(10);
    const ids = result.map((collection) => collection.id);
    expect(ids).toContain(featured.id);
    expect(ids).not.toContain(noImage.id);
    expect(ids).not.toContain(inactive.id);
  });

  it("excludes a collection outside its start/end date window, and includes one with no window set", async () => {
    const admin = await makeFullAccessAdmin();
    const alwaysOn = await createCollectionAdmin(admin.id, { name: "Always On", slug: slug("always-on"), status: "Active", image: "/media-files/x.jpg" });
    const future = await createCollectionAdmin(admin.id, {
      name: "Future",
      slug: slug("future"),
      status: "Active",
      image: "/media-files/x.jpg",
      startDate: "2099-01-01",
    });
    const expired = await createCollectionAdmin(admin.id, {
      name: "Expired",
      slug: slug("expired"),
      status: "Active",
      image: "/media-files/x.jpg",
      endDate: "2000-01-01",
    });

    const result = await getFeaturedCollectionsForStorefront(10);
    const ids = result.map((collection) => collection.id);
    expect(ids).toContain(alwaysOn.id);
    expect(ids).not.toContain(future.id);
    expect(ids).not.toContain(expired.id);
  });
});
