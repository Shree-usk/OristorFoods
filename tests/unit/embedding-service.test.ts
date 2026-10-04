// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import type { EmbeddingProvider } from "@/services/embedding/embedding-provider.interface";
import {
  recomputeAllEmbeddings,
  refreshContentEmbeddingBestEffort,
  refreshProductEmbeddingBestEffort,
  setEmbeddingProviderForTesting,
} from "@/services/embedding.service";
import { PermissionDeniedError } from "@/services/permission.errors";

const EMAIL_DOMAIN = "@embedding-svc-test.test";
const ROLE_KEY_PREFIX = "embedding-svc-test-role-";
const SKU_PREFIX = "EMBED-SVC-SKU-";
const CATEGORY_SLUG_PREFIX = "embed-svc-category-";
const RECIPE_SLUG_PREFIX = "embed-svc-recipe-";
const AUTHOR_SLUG_PREFIX = "embed-svc-author-";
const BLOG_SLUG_PREFIX = "embed-svc-blog-";
let sequence = 0;

function fakeEmbedding(seed: number): number[] {
  return Array.from({ length: 1536 }, (_, i) => Math.sin(seed + i));
}

function makeFakeProvider(overrides: Partial<EmbeddingProvider> = {}): EmbeddingProvider {
  return {
    name: "fake",
    generateEmbedding: async (text: string) => ({ embedding: fakeEmbedding(text.length), tokensUsed: text.length }),
    ...overrides,
  };
}

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Embed Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

async function makeProduct(status: "Draft" | "Published" = "Published") {
  sequence += 1;
  return createProduct({ sku: `${SKU_PREFIX}${sequence}`, slug: `embed-svc-product-${sequence}`, name: `Embed Svc Test Product ${sequence}`, status, stockQuantity: 10 });
}

async function makeRecipe(status: "Draft" | "Published" = "Published") {
  sequence += 1;
  const category = await prisma.recipeCategory.create({ data: { name: `Embed Svc Category ${sequence}`, slug: `${CATEGORY_SLUG_PREFIX}${sequence}` } });
  return prisma.recipe.create({
    data: {
      slug: `${RECIPE_SLUG_PREFIX}${sequence}`,
      title: `Embed Svc Test Recipe ${sequence}`,
      shortDescription: "A test recipe.",
      heroImage: "/placeholder.jpg",
      heroImageAlt: "placeholder",
      categoryId: category.id,
      difficulty: "Easy",
      prepTimeMinutes: 5,
      cookTimeMinutes: 5,
      totalTimeMinutes: 10,
      servings: 2,
      status,
    },
  });
}

async function makeBlogPost(status: "Draft" | "Published" = "Published") {
  sequence += 1;
  const author = await prisma.blogAuthor.create({ data: { name: `Embed Svc Author ${sequence}`, slug: `${AUTHOR_SLUG_PREFIX}${sequence}` } });
  return prisma.blogPost.create({
    data: {
      slug: `${BLOG_SLUG_PREFIX}${sequence}`,
      title: `Embed Svc Test Post ${sequence}`,
      excerpt: "A test post.",
      bodyContent: "Body.",
      authorId: author.id,
      status,
      // findPublishedBlogPosts requires publishedAt <= now, not just status === "Published".
      publishedAt: status === "Published" ? new Date() : null,
    },
  });
}

afterEach(async () => {
  setEmbeddingProviderForTesting(makeFakeProvider());
  // Full-table wipe, not prefix-scoped: recomputeAllEmbeddings (used by the
  // tests below) embeds every Published row in the whole dev DB, not just
  // this file's own fixtures — a fake, sine-wave "embedding" from this
  // test's fake provider must never linger on real seeded content.
  await prisma.productEmbedding.deleteMany();
  await prisma.contentEmbedding.deleteMany();
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.recipe.deleteMany({ where: { slug: { startsWith: RECIPE_SLUG_PREFIX } } });
  await prisma.recipeCategory.deleteMany({ where: { slug: { startsWith: CATEGORY_SLUG_PREFIX } } });
  await prisma.blogPost.deleteMany({ where: { slug: { startsWith: BLOG_SLUG_PREFIX } } });
  await prisma.blogAuthor.deleteMany({ where: { slug: { startsWith: AUTHOR_SLUG_PREFIX } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("embedding.service — best-effort refresh", () => {
  it("writes a ProductEmbedding for a Published product", async () => {
    setEmbeddingProviderForTesting(makeFakeProvider());
    const product = await makeProduct("Published");

    await refreshProductEmbeddingBestEffort(product.id);

    const embedding = await prisma.productEmbedding.findUnique({ where: { productId: product.id } });
    expect(embedding).not.toBeNull();
  });

  it("skips a Draft product without calling the provider", async () => {
    let called = false;
    setEmbeddingProviderForTesting(makeFakeProvider({ generateEmbedding: async () => { called = true; return { embedding: fakeEmbedding(1), tokensUsed: 1 }; } }));
    const product = await makeProduct("Draft");

    await refreshProductEmbeddingBestEffort(product.id);

    expect(called).toBe(false);
    const embedding = await prisma.productEmbedding.findUnique({ where: { productId: product.id } });
    expect(embedding).toBeNull();
  });

  it("never throws when the provider fails — the STORY-060 lesson applied proactively", async () => {
    setEmbeddingProviderForTesting(makeFakeProvider({ generateEmbedding: async () => { throw new Error("provider down"); } }));
    const product = await makeProduct("Published");

    await expect(refreshProductEmbeddingBestEffort(product.id)).resolves.toBeUndefined();
  });

  it("writes a ContentEmbedding for a Published recipe, skips a Draft one", async () => {
    setEmbeddingProviderForTesting(makeFakeProvider());
    const published = await makeRecipe("Published");
    const draft = await makeRecipe("Draft");

    await refreshContentEmbeddingBestEffort("Recipe", published.id);
    await refreshContentEmbeddingBestEffort("Recipe", draft.id);

    const publishedEmbedding = await prisma.contentEmbedding.findUnique({ where: { sourceType_sourceId: { sourceType: "Recipe", sourceId: published.id } } });
    const draftEmbedding = await prisma.contentEmbedding.findUnique({ where: { sourceType_sourceId: { sourceType: "Recipe", sourceId: draft.id } } });
    expect(publishedEmbedding).not.toBeNull();
    expect(draftEmbedding).toBeNull();
  });

  it("writes a ContentEmbedding for a Published blog post", async () => {
    setEmbeddingProviderForTesting(makeFakeProvider());
    const post = await makeBlogPost("Published");

    await refreshContentEmbeddingBestEffort("BlogPost", post.id);

    const embedding = await prisma.contentEmbedding.findUnique({ where: { sourceType_sourceId: { sourceType: "BlogPost", sourceId: post.id } } });
    expect(embedding).not.toBeNull();
  });
});

describe("embedding.service — recomputeAllEmbeddings", () => {
  it("requires Products:Edit", async () => {
    const viewOnlyAdmin = await makeAdmin([{ module: "Products", action: "View" }]);
    await expect(recomputeAllEmbeddings(viewOnlyAdmin.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("embeds Published products/recipes/blog posts and reports per-type counts and total tokens", async () => {
    setEmbeddingProviderForTesting(makeFakeProvider());
    const admin = await makeAdmin([{ module: "Products", action: "Edit" }]);
    await makeProduct("Published");
    await makeRecipe("Published");
    await makeBlogPost("Published");

    const result = await recomputeAllEmbeddings(admin.id);

    expect(result.productsEmbedded).toBeGreaterThanOrEqual(1);
    expect(result.recipesEmbedded).toBeGreaterThanOrEqual(1);
    expect(result.blogPostsEmbedded).toBeGreaterThanOrEqual(1);
    expect(result.failures).toBe(0);
    expect(result.totalTokensUsed).toBeGreaterThan(0);
  });

  it("counts a provider failure as a failure without throwing, for the real no-credits fallback path", async () => {
    setEmbeddingProviderForTesting(makeFakeProvider({ generateEmbedding: async () => { throw new Error("429 insufficient_quota"); } }));
    const admin = await makeAdmin([{ module: "Products", action: "Edit" }]);
    await makeProduct("Published");

    const result = await recomputeAllEmbeddings(admin.id);

    expect(result.productsEmbedded).toBe(0);
    expect(result.failures).toBeGreaterThanOrEqual(1);
  });
});
