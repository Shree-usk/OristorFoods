import { SITE_URL } from "@/lib/site-url";
import * as blogRepository from "@/repositories/blog.repository";
import * as categoryRepository from "@/repositories/category.repository";
import * as collectionRepository from "@/repositories/collection.repository";
import * as cookingTipRepository from "@/repositories/cooking-tip.repository";
import * as foodAcademyRepository from "@/repositories/food-academy.repository";
import * as landingPageRepository from "@/repositories/landing-page.repository";
import * as productRepository from "@/repositories/product.repository";
import * as recipeRepository from "@/repositories/recipe.repository";
import * as redirectRepository from "@/repositories/redirect.repository";
import * as seoRepository from "@/repositories/seo.repository";

export interface SitemapEntry {
  url: string;
  lastModified?: Date;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}

const BULK_LIST_SIZE = 10_000; // Next's own per-sitemap-file cap is 50,000; this catalog is far smaller — no pagination needed.

/**
 * STORY-051c. Fans out to every content type's existing bulk "published"
 * repository function in parallel, then excludes (a) anything an admin
 * turned robotsIndex off for (SeoMeta, Product/Recipe/BlogPost only —
 * the only three SeoEntityType values) and (b) any path that's an active
 * Redirect source (051b) — a redirected URL shouldn't appear in the
 * sitemap pointing crawlers at a 30x response.
 */
export async function buildSitemapEntries(): Promise<SitemapEntry[]> {
  const [
    products,
    recipeResult,
    blogResult,
    cookingTipResult,
    foodAcademyResult,
    landingPages,
    categories,
    collections,
    redirects,
    excludedProductIds,
    excludedRecipeIds,
    excludedBlogPostIds,
  ] = await Promise.all([
    productRepository.findPublishedProductsForListing({ take: BULK_LIST_SIZE }),
    recipeRepository.findPublishedRecipes({ where: { status: "Published" }, orderBy: [{ publishedAt: "desc" }], skip: 0, take: BULK_LIST_SIZE }),
    blogRepository.findPublishedBlogPosts({ where: {}, skip: 0, take: BULK_LIST_SIZE }),
    cookingTipRepository.findPublishedCookingTips({ where: {}, skip: 0, take: BULK_LIST_SIZE }),
    foodAcademyRepository.findPublishedFoodAcademyEntries({ where: {}, skip: 0, take: BULK_LIST_SIZE }),
    landingPageRepository.listPublishedLandingPages(),
    categoryRepository.listAllCategories(),
    collectionRepository.listActiveCollections(),
    redirectRepository.listActiveRedirects(),
    seoRepository.listRobotsExcludedEntityIds("Product"),
    seoRepository.listRobotsExcludedEntityIds("Recipe"),
    seoRepository.listRobotsExcludedEntityIds("BlogPost"),
  ]);

  const excludedProductIdSet = new Set(excludedProductIds.map((r) => r.entityId));
  const excludedRecipeIdSet = new Set(excludedRecipeIds.map((r) => r.entityId));
  const excludedBlogPostIdSet = new Set(excludedBlogPostIds.map((r) => r.entityId));
  const redirectedSourcePaths = new Set(redirects.map((r) => r.sourcePath));

  const entries: SitemapEntry[] = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/products`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/recipes`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/blog`, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/food-academy`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/downloads`, changeFrequency: "monthly", priority: 0.4 },
  ];

  for (const product of products) {
    if (excludedProductIdSet.has(product.id)) continue;
    entries.push({ url: `${SITE_URL}/products/${product.slug}`, lastModified: product.updatedAt, changeFrequency: "weekly", priority: 0.8 });
  }
  for (const recipe of recipeResult.rows) {
    if (excludedRecipeIdSet.has(recipe.id)) continue;
    entries.push({ url: `${SITE_URL}/recipes/${recipe.slug}`, changeFrequency: "weekly", priority: 0.7 });
  }
  for (const post of blogResult.rows) {
    if (excludedBlogPostIdSet.has(post.id)) continue;
    entries.push({ url: `${SITE_URL}/blog/${post.slug}`, lastModified: post.publishedAt ?? undefined, changeFrequency: "monthly", priority: 0.5 });
  }
  for (const tip of cookingTipResult.rows) {
    entries.push({ url: `${SITE_URL}/recipes/cooking-tips/${tip.slug}`, changeFrequency: "monthly", priority: 0.5 });
  }
  for (const entry of foodAcademyResult.rows) {
    entries.push({ url: `${SITE_URL}/food-academy/${entry.slug}`, changeFrequency: "monthly", priority: 0.5 });
  }
  for (const landingPage of landingPages) {
    entries.push({ url: `${SITE_URL}/landing/${landingPage.slug}`, lastModified: landingPage.updatedAt, changeFrequency: "weekly", priority: 0.6 });
  }
  for (const category of categories) {
    if (category.status !== "Active") continue;
    entries.push({ url: `${SITE_URL}/products/category/${category.slug}`, changeFrequency: "weekly", priority: 0.6 });
  }
  for (const collection of collections) {
    entries.push({ url: `${SITE_URL}/products/collections/${collection.slug}`, changeFrequency: "weekly", priority: 0.6 });
  }

  return entries.filter((entry) => {
    const path = entry.url.replace(SITE_URL, "");
    return !redirectedSourcePaths.has(path);
  });
}
