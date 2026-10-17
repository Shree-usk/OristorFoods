// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createCollection } from "@/repositories/collection.repository";
import { findExportCatalogueProductsByIds } from "@/repositories/product.repository";
import { PermissionDeniedError } from "@/services/permission.errors";
import {
  bulkSetExportVisibilityForAdmin,
  generateExportCataloguePdf,
  getExportCatalogueSettingForAdmin,
  listExportCatalogueProducts,
  listExportCatalogueProductsForAdmin,
  updateExportCatalogueSettingForAdmin,
} from "@/services/export-catalogue.service";

const SKU_PREFIX = "EXPORT-CATALOGUE-SVC-TEST-";
const EMAIL_DOMAIN = "@export-catalogue-svc-test.test";
const ROLE_KEY_PREFIX = "export-catalogue-svc-test-role-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Export Catalogue Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

function fullAccessAdmin() {
  return makeAdmin([
    { module: "ExportPortal", action: "View" },
    { module: "ExportPortal", action: "Edit" },
  ]);
}

async function makeProduct(overrides: Partial<Parameters<typeof prisma.product.create>[0]["data"]> = {}) {
  sequence += 1;
  return prisma.product.create({
    data: {
      sku: `${SKU_PREFIX}${sequence}`,
      slug: `export-catalogue-svc-test-${sequence}`,
      name: `Export Catalogue Test Product ${sequence}`,
      status: "Published",
      isExportEnabled: false,
      ...overrides,
    },
  });
}

afterEach(async () => {
  await prisma.exportCatalogueSetting.deleteMany({ where: { id: "global" } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.collection.deleteMany({ where: { slug: { startsWith: "export-catalogue-svc-test-" } } });
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("export-catalogue.service — listExportCatalogueProducts (public)", () => {
  it("only returns Published + isExportEnabled products — never a Draft, Archived, or export-disabled product", async () => {
    const visible = await makeProduct({ isExportEnabled: true });
    await makeProduct({ isExportEnabled: false }); // Published but not export-enabled
    await makeProduct({ isExportEnabled: true, status: "Draft" });
    await makeProduct({ isExportEnabled: true, status: "Archived" });

    const result = await listExportCatalogueProducts({});

    expect(result.items.map((item) => item.id)).toEqual([visible.id]);
  });

  it("never includes a price field — showPricing is deliberately not wired up yet (deferred, see export-catalogue-admin.schema.ts)", async () => {
    await makeProduct({ isExportEnabled: true });
    const result = await listExportCatalogueProducts({});
    expect(result.items[0]).not.toHaveProperty("price");
    expect(result.items[0]).not.toHaveProperty("standardPrices");
  });

  it("filters by collectionSlug", async () => {
    const collection = await createCollection({ name: "Export Catalogue Svc Test Collection", slug: "export-catalogue-svc-test-collection" });
    const inCollection = await makeProduct({ isExportEnabled: true, collections: { connect: { id: collection.id } } });
    await makeProduct({ isExportEnabled: true });

    const result = await listExportCatalogueProducts({ collectionSlug: "export-catalogue-svc-test-collection" });

    expect(result.items.map((item) => item.id)).toEqual([inCollection.id]);
  });

  it("filters by search (name or SKU, case-insensitive)", async () => {
    const match = await makeProduct({ isExportEnabled: true, name: "Ceylon Cinnamon Sticks" });
    await makeProduct({ isExportEnabled: true, name: "Something Else Entirely" });

    const result = await listExportCatalogueProducts({ search: "cinnamon" });

    expect(result.items.map((item) => item.id)).toEqual([match.id]);
  });
});

describe("export-catalogue.service — generateExportCataloguePdf visibility (security boundary)", () => {
  it("silently excludes a Draft product's id rather than including it in the PDF data", async () => {
    const draft = await makeProduct({ isExportEnabled: true, status: "Draft" });
    const published = await makeProduct({ isExportEnabled: true });

    const products = await findExportCatalogueProductsByIds([draft.id, published.id, "not-a-real-id"]);

    expect(products.map((p) => p.id)).toEqual([published.id]);
  });

  it("still renders a valid PDF buffer when every supplied id is invalid/unpublished", async () => {
    const buffer = await generateExportCataloguePdf(["not-a-real-id"]);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});

describe("export-catalogue.service — admin catalogue management permission gating", () => {
  it("rejects an admin without ExportPortal:View from the admin list", async () => {
    const stranger = await makeAdmin([]);
    await expect(listExportCatalogueProductsForAdmin(stranger.id, {}, 1)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("the admin list includes Draft and export-disabled products — unlike the public listing", async () => {
    const admin = await fullAccessAdmin();
    const draft = await makeProduct({ isExportEnabled: false, status: "Draft" });

    const result = await listExportCatalogueProductsForAdmin(admin.id, {}, 1);

    expect(result.items.some((item) => item.id === draft.id)).toBe(true);
  });

  it("rejects an admin with only View from bulk-toggling export visibility", async () => {
    const viewer = await makeAdmin([{ module: "ExportPortal", action: "View" }]);
    const product = await makeProduct();
    await expect(bulkSetExportVisibilityForAdmin(viewer.id, [product.id], true)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("bulk-enables export visibility and writes an audit log entry", async () => {
    const admin = await fullAccessAdmin();
    const product = await makeProduct({ isExportEnabled: false });

    const result = await bulkSetExportVisibilityForAdmin(admin.id, [product.id], true);
    expect(result.updatedCount).toBe(1);

    const updated = await prisma.product.findUnique({ where: { id: product.id } });
    expect(updated?.isExportEnabled).toBe(true);

    const logs = await prisma.auditLog.findMany({ where: { actorId: admin.id, action: "export_catalogue_products_enabled" } });
    expect(logs.length).toBe(1);
  });

  it("never enables/disables any field on a product id outside the given list", async () => {
    const admin = await fullAccessAdmin();
    const untouched = await makeProduct({ isExportEnabled: false });
    const toggled = await makeProduct({ isExportEnabled: false });

    await bulkSetExportVisibilityForAdmin(admin.id, [toggled.id], true);

    expect((await prisma.product.findUnique({ where: { id: untouched.id } }))?.isExportEnabled).toBe(false);
    expect((await prisma.product.findUnique({ where: { id: toggled.id } }))?.isExportEnabled).toBe(true);
  });
});

describe("export-catalogue.service — admin catalogue settings permission gating", () => {
  it("rejects an admin without ExportPortal:View from reading settings", async () => {
    const stranger = await makeAdmin([]);
    await expect(getExportCatalogueSettingForAdmin(stranger.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects an admin with only View from updating settings", async () => {
    const viewer = await makeAdmin([{ module: "ExportPortal", action: "View" }]);
    await expect(updateExportCatalogueSettingForAdmin(viewer.id, { title: "x" })).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("persists settings and never duplicates CompanySetting's own fields (no logo/address/phone field exists on the schema)", async () => {
    const admin = await fullAccessAdmin();

    expect(await getExportCatalogueSettingForAdmin(admin.id)).toBeNull();

    const updated = await updateExportCatalogueSettingForAdmin(admin.id, { title: "ORISTOR Export Catalogue", introText: "Intro", showPricing: true });
    expect(updated.title).toBe("ORISTOR Export Catalogue");
    expect(updated.showPricing).toBe(true);
    expect(updated).not.toHaveProperty("logoUrl");
    expect(updated).not.toHaveProperty("address");

    const fetched = await getExportCatalogueSettingForAdmin(admin.id);
    expect(fetched?.title).toBe("ORISTOR Export Catalogue");
  });
});
