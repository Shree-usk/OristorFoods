// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { findSeoMeta, upsertSeoMeta } from "@/repositories/seo.repository";
import { bulkApplyTitleTemplate, listSeoPagesForAdmin } from "@/services/seo-pages.service";
import { cleanupRecipes, makeBlogAuthor, makeBlogPost, makeCategory as makeRecipeCategory, makeRecipe } from "./recipe-fixtures";

const SKU_PREFIX = "SEO-PAGES-SVC-";
const SLUG_PREFIX = "seo-pages-svc-";
const EMAIL_DOMAIN = "@seo-pages-svc-test.test";
const ROLE_KEY_PREFIX = "seo-pages-svc-role-";
let sequence = 0;

async function makeProduct(overrides: { status?: "Draft" | "Published" | "Archived" } = {}) {
  sequence += 1;
  return prisma.product.create({
    data: { sku: `${SKU_PREFIX}${sequence}`, slug: `${SLUG_PREFIX}product-${sequence}`, name: `SEO Pages Svc Product ${sequence}`, status: overrides.status ?? "Published" },
  });
}

async function makeFullAccessAdmin() {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `SEO Pages Svc Role ${sequence}` } });
  const grants: { module: AdminModule; action: AdminAction }[] = [
    { module: "SEO", action: "View" },
    { module: "SEO", action: "Edit" },
    { module: "Products", action: "View" },
    { module: "Recipes", action: "View" },
    { module: "Blog", action: "View" },
  ];
  await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

afterEach(async () => {
  await cleanupRecipes();
  await prisma.seoMeta.deleteMany();
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("seo-pages.service — listSeoPagesForAdmin", () => {
  it("includes a Product, Recipe, and BlogPost regardless of status (Draft included, not just Published)", async () => {
    const admin = await makeFullAccessAdmin();
    const draftProduct = await makeProduct({ status: "Draft" });
    const recipeCategory = await makeRecipeCategory();
    const recipe = await makeRecipe(recipeCategory.id, { status: "Draft" });
    const author = await makeBlogAuthor();
    const post = await makeBlogPost({ authorId: author.id, status: "Draft", publishedAt: null });

    const rows = await listSeoPagesForAdmin(admin.id);
    const keys = rows.map((row) => `${row.entityType}:${row.entityId}`);

    expect(keys).toContain(`Product:${draftProduct.id}`);
    expect(keys).toContain(`Recipe:${recipe.id}`);
    expect(keys).toContain(`BlogPost:${post.id}`);
  });

  it("flags two pages that resolve to the same effective title (one via its own name, one via an explicit metaTitle override) as duplicates", async () => {
    const admin = await makeFullAccessAdmin();
    const sharedTitle = `SEO Pages Svc Shared Title ${Date.now()}`;
    const first = await makeProduct();
    await prisma.product.update({ where: { id: first.id }, data: { name: sharedTitle } });
    const second = await makeProduct();
    await upsertSeoMeta("Product", second.id, {
      metaTitle: sharedTitle,
      metaDescription: null,
      canonicalUrl: null,
      ogImageUrl: null,
      ogImageAlt: null,
      ogImageWidth: null,
      ogImageHeight: null,
      robotsIndex: true,
      robotsFollow: true,
      focusKeyword: null,
    });
    const unrelated = await makeProduct();

    const rows = await listSeoPagesForAdmin(admin.id);
    const byId = (id: string) => rows.find((row) => row.entityId === id);

    expect(byId(first.id)?.isDuplicateTitle).toBe(true);
    expect(byId(second.id)?.isDuplicateTitle).toBe(true);
    expect(byId(unrelated.id)?.isDuplicateTitle).toBe(false);
  });

  it("surfaces computeSeoHealth's missingDescription check for a page with no SeoMeta row at all", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();

    const rows = await listSeoPagesForAdmin(admin.id);
    const row = rows.find((r) => r.entityId === product.id);

    expect(row?.health.find((check) => check.id === "missingDescription")?.ok).toBe(false);
  });
});

describe("seo-pages.service — bulkApplyTitleTemplate", () => {
  it("expands {title} with each entity's own display title and preserves the row's other existing SeoMeta fields", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    await upsertSeoMeta("Product", product.id, {
      metaTitle: "Old title",
      metaDescription: "An existing description that must survive.",
      canonicalUrl: "https://oristor.com/products/x",
      ogImageUrl: null,
      ogImageAlt: null,
      ogImageWidth: null,
      ogImageHeight: null,
      robotsIndex: true,
      robotsFollow: true,
      focusKeyword: null,
    });

    const result = await bulkApplyTitleTemplate(admin.id, [{ entityType: "Product", entityId: product.id, title: product.name }], "{title} | Oristor");

    expect(result.succeeded).toEqual([{ entityType: "Product", entityId: product.id }]);
    expect(result.failed).toEqual([]);

    const updated = await findSeoMeta("Product", product.id);
    expect(updated?.metaTitle).toBe(`${product.name} | Oristor`);
    expect(updated?.metaDescription).toBe("An existing description that must survive.");
    expect(updated?.canonicalUrl).toBe("https://oristor.com/products/x");
  });

  it("creates a new SeoMeta row for an entity that never had one, defaulting robots flags to true", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();

    const result = await bulkApplyTitleTemplate(admin.id, [{ entityType: "Product", entityId: product.id, title: product.name }], "{title} — Sri Lankan");

    expect(result.succeeded).toHaveLength(1);
    const created = await findSeoMeta("Product", product.id);
    expect(created?.metaTitle).toBe(`${product.name} — Sri Lankan`);
    expect(created?.robotsIndex).toBe(true);
    expect(created?.robotsFollow).toBe(true);
  });
});
