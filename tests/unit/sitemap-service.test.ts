// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/site-url";
import { createRedirect } from "@/repositories/redirect.repository";
import { createLandingPage, updateLandingPageStatus } from "@/repositories/landing-page.repository";
import { upsertSeoMeta } from "@/repositories/seo.repository";
import { buildSitemapEntries } from "@/services/sitemap.service";
import { cleanupRecipes, makeBlogAuthor, makeBlogPost, makeCategory as makeRecipeCategory, makeRecipe } from "./recipe-fixtures";

const SKU_PREFIX = "SITEMAP-SVC-";
const SLUG_PREFIX = "sitemap-svc-";
const EMAIL_DOMAIN = "@sitemap-svc-test.test";
let sequence = 0;

async function makeProduct(overrides: { robotsIndex?: boolean } = {}) {
  sequence += 1;
  const product = await prisma.product.create({
    data: { sku: `${SKU_PREFIX}${sequence}`, slug: `${SLUG_PREFIX}product-${sequence}`, name: `Sitemap Svc Product ${sequence}`, status: "Published" },
  });
  if (overrides.robotsIndex === false) {
    await upsertSeoMeta("Product", product.id, {
      metaTitle: null,
      metaDescription: null,
      canonicalUrl: null,
      ogImageUrl: null,
      ogImageAlt: null,
      robotsIndex: false,
      robotsFollow: true,
      focusKeyword: null,
    });
  }
  return product;
}

async function makeAdminUser() {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `sitemap-svc-test-role-${sequence}`, name: `Sitemap Svc Test Role ${sequence}` } });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

afterEach(async () => {
  await cleanupRecipes();
  await prisma.seoMeta.deleteMany();
  await prisma.redirect.deleteMany();
  await prisma.landingPageBlock.deleteMany();
  await prisma.landingPage.deleteMany();
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.collection.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: "sitemap-svc-test-role-" } } });
});

describe("sitemap.service — buildSitemapEntries", () => {
  it("includes the static top-level pages", async () => {
    const entries = await buildSitemapEntries();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(SITE_URL);
    expect(urls).toContain(`${SITE_URL}/products`);
    expect(urls).toContain(`${SITE_URL}/recipes`);
  });

  it("includes a published product, recipe, and blog post", async () => {
    const product = await makeProduct();
    const recipeCategory = await makeRecipeCategory();
    const recipe = await makeRecipe(recipeCategory.id);
    const author = await makeBlogAuthor();
    const post = await makeBlogPost({ authorId: author.id, publishedAt: new Date() });

    const entries = await buildSitemapEntries();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain(`${SITE_URL}/products/${product.slug}`);
    expect(urls).toContain(`${SITE_URL}/recipes/${recipe.slug}`);
    expect(urls).toContain(`${SITE_URL}/blog/${post.slug}`);
  });

  it("excludes a product whose SeoMeta.robotsIndex is false", async () => {
    const indexed = await makeProduct();
    const excluded = await makeProduct({ robotsIndex: false });

    const entries = await buildSitemapEntries();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain(`${SITE_URL}/products/${indexed.slug}`);
    expect(urls).not.toContain(`${SITE_URL}/products/${excluded.slug}`);
  });

  it("excludes a path that is an active Redirect source", async () => {
    const product = await makeProduct();
    const admin = await makeAdminUser();
    await createRedirect({ sourcePath: `/products/${product.slug}`, destinationPath: "/products", statusCode: 301, active: true }, admin.id);

    const entries = await buildSitemapEntries();
    const urls = entries.map((e) => e.url);

    expect(urls).not.toContain(`${SITE_URL}/products/${product.slug}`);
  });

  it("includes an active collection and category, and a published landing page", async () => {
    sequence += 1;
    const category = await prisma.category.create({ data: { name: `Sitemap Svc Category ${sequence}`, slug: `${SLUG_PREFIX}category-${sequence}`, status: "Active" } });
    const collection = await prisma.collection.create({ data: { name: `Sitemap Svc Collection ${sequence}`, slug: `${SLUG_PREFIX}collection-${sequence}`, status: "Active" } });

    const admin = await makeAdminUser();
    const landingPage = await createLandingPage({ name: "Sitemap Svc Landing", slug: `${SLUG_PREFIX}landing-${sequence}`, metaTitle: null, metaDescription: null }, admin.id);
    await updateLandingPageStatus(landingPage.id, "Published", new Date());

    const entries = await buildSitemapEntries();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain(`${SITE_URL}/products/category/${category.slug}`);
    expect(urls).toContain(`${SITE_URL}/products/collections/${collection.slug}`);
    expect(urls).toContain(`${SITE_URL}/landing/${landingPage.slug}`);
  });
});
