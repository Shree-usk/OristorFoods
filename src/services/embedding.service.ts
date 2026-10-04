import type { ContentSourceType } from "@/generated/prisma/client";
import * as embeddingRepository from "@/repositories/embedding.repository";
import { findProductById } from "@/repositories/product.repository";
import { findRecipeAdminDetailById, findPublishedRecipes } from "@/repositories/recipe.repository";
import { findBlogPostAdminDetailById, findPublishedBlogPosts } from "@/repositories/blog.repository";
import { findFoodAcademyEntryById, findPublishedFoodAcademyEntries } from "@/repositories/food-academy.repository";
import { findPublishedProductsForListing } from "@/repositories/product.repository";
import { OpenAiEmbeddingProvider } from "@/services/embedding/openai-embedding.provider";
import type { EmbeddingProvider } from "@/services/embedding/embedding-provider.interface";
import { requirePermission } from "@/services/permission.service";
import { writeAuditLog } from "@/services/audit-log.service";

/**
 * STORY-061. Orchestrates embedding generation — never the API routes
 * or content admin services calling the provider directly. Refresh
 * happens two ways, same "no cron exists" pattern as
 * STORY-050d/STORY-059c/STORY-060: a best-effort, fire-and-forget call
 * from each content type's existing publish/update path (Product,
 * Recipe, Blog — Food Academy has no admin write service yet in this
 * codebase, so it's covered only by the full recompute below, not an
 * inline hook that doesn't exist to hang off), and a real, gated full
 * recompute for backfill/catch-up.
 */

const MODEL_VERSION = "text-embedding-3-small";
const RECOMPUTE_BATCH_SIZE = 500;

let provider: EmbeddingProvider = new OpenAiEmbeddingProvider();

/** Test-only seam — mirrors search-extensions.ts's resetSearchExtensionsForTesting shape. */
export function setEmbeddingProviderForTesting(nextProvider: EmbeddingProvider) {
  provider = nextProvider;
}

function buildProductText(product: { name: string; shortDescription: string | null; story: string | null }): string {
  return [product.name, product.shortDescription, product.story].filter(Boolean).join(". ");
}

function buildTitleDescriptionText(title: string, description: string | null): string {
  return [title, description].filter(Boolean).join(". ");
}

// --- Best-effort, inline refresh — called fire-and-forget, never awaited by the caller. ---

export async function refreshProductEmbeddingBestEffort(productId: string): Promise<void> {
  try {
    const product = await findProductById(productId);
    if (!product || product.status !== "Published") return;
    const { embedding, tokensUsed } = await provider.generateEmbedding(buildProductText(product));
    await embeddingRepository.upsertProductEmbedding(productId, embedding, MODEL_VERSION);
    void tokensUsed;
  } catch (error) {
    console.error(`[embedding] failed to refresh product embedding for ${productId}`, error);
  }
}

export async function refreshContentEmbeddingBestEffort(sourceType: ContentSourceType, sourceId: string): Promise<void> {
  try {
    const text = await buildContentText(sourceType, sourceId);
    if (!text) return;
    const { embedding } = await provider.generateEmbedding(text);
    await embeddingRepository.upsertContentEmbedding(sourceType, sourceId, embedding, MODEL_VERSION);
  } catch (error) {
    console.error(`[embedding] failed to refresh ${sourceType} embedding for ${sourceId}`, error);
  }
}

async function buildContentText(sourceType: ContentSourceType, sourceId: string): Promise<string | null> {
  switch (sourceType) {
    case "Recipe": {
      const recipe = await findRecipeAdminDetailById(sourceId);
      if (!recipe || recipe.status !== "Published") return null;
      return buildTitleDescriptionText(recipe.title, recipe.shortDescription);
    }
    case "BlogPost": {
      const post = await findBlogPostAdminDetailById(sourceId);
      if (!post || post.status !== "Published") return null;
      return buildTitleDescriptionText(post.title, post.excerpt);
    }
    case "FoodAcademyEntry": {
      const entry = await findFoodAcademyEntryById(sourceId);
      if (!entry || entry.status !== "Published") return null;
      return buildTitleDescriptionText(entry.title, entry.summary);
    }
  }
}

// --- Full recompute — admin-triggered, no cron exists in this codebase. ---

export interface RecomputeEmbeddingsResult {
  productsEmbedded: number;
  recipesEmbedded: number;
  blogPostsEmbedded: number;
  foodAcademyEntriesEmbedded: number;
  failures: number;
  totalTokensUsed: number;
}

export async function recomputeAllEmbeddings(adminUserId: string): Promise<RecomputeEmbeddingsResult> {
  await requirePermission(adminUserId, "Products", "Edit");
  await embeddingRepository.ensureVectorIndexes();

  const result: RecomputeEmbeddingsResult = {
    productsEmbedded: 0,
    recipesEmbedded: 0,
    blogPostsEmbedded: 0,
    foodAcademyEntriesEmbedded: 0,
    failures: 0,
    totalTokensUsed: 0,
  };

  const products = await findPublishedProductsForListing({ take: RECOMPUTE_BATCH_SIZE });
  for (const product of products) {
    try {
      const { embedding, tokensUsed } = await provider.generateEmbedding(buildProductText(product));
      await embeddingRepository.upsertProductEmbedding(product.id, embedding, MODEL_VERSION);
      result.productsEmbedded += 1;
      result.totalTokensUsed += tokensUsed;
    } catch (error) {
      result.failures += 1;
      console.error(`[embedding] recompute failed for product ${product.id}`, error);
    }
  }

  // recipeCardSelect has no shortDescription (that's admin-detail-only) — title alone is a reasonable, if thinner, batch-recompute signal; the inline per-record refresh (findRecipeAdminDetailById) is richer.
  const { rows: recipes } = await findPublishedRecipes({ where: { status: "Published" }, orderBy: [{ publishedAt: "desc" }], skip: 0, take: RECOMPUTE_BATCH_SIZE });
  for (const recipe of recipes) {
    try {
      const { embedding, tokensUsed } = await provider.generateEmbedding(recipe.title);
      await embeddingRepository.upsertContentEmbedding("Recipe", recipe.id, embedding, MODEL_VERSION);
      result.recipesEmbedded += 1;
      result.totalTokensUsed += tokensUsed;
    } catch (error) {
      result.failures += 1;
      console.error(`[embedding] recompute failed for recipe ${recipe.id}`, error);
    }
  }

  const { rows: blogPosts } = await findPublishedBlogPosts({ where: {}, skip: 0, take: RECOMPUTE_BATCH_SIZE });
  for (const post of blogPosts) {
    try {
      const { embedding, tokensUsed } = await provider.generateEmbedding(buildTitleDescriptionText(post.title, post.excerpt));
      await embeddingRepository.upsertContentEmbedding("BlogPost", post.id, embedding, MODEL_VERSION);
      result.blogPostsEmbedded += 1;
      result.totalTokensUsed += tokensUsed;
    } catch (error) {
      result.failures += 1;
      console.error(`[embedding] recompute failed for blog post ${post.id}`, error);
    }
  }

  const { rows: foodAcademyEntries } = await findPublishedFoodAcademyEntries({ where: {}, skip: 0, take: RECOMPUTE_BATCH_SIZE });
  for (const entry of foodAcademyEntries) {
    try {
      const { embedding, tokensUsed } = await provider.generateEmbedding(buildTitleDescriptionText(entry.title, entry.summary));
      await embeddingRepository.upsertContentEmbedding("FoodAcademyEntry", entry.id, embedding, MODEL_VERSION);
      result.foodAcademyEntriesEmbedded += 1;
      result.totalTokensUsed += tokensUsed;
    } catch (error) {
      result.failures += 1;
      console.error(`[embedding] recompute failed for food academy entry ${entry.id}`, error);
    }
  }

  await writeAuditLog({ actorId: adminUserId, action: "search_embeddings_recomputed", module: "Products", metadata: { ...result } });
  return result;
}
