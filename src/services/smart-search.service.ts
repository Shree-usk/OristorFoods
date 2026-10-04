import type { CustomerGroup } from "@/generated/prisma/client";
import * as embeddingRepository from "@/repositories/embedding.repository";
import * as searchRepository from "@/repositories/search.repository";
import * as productRepository from "@/repositories/product.repository";
import { toProductListItem } from "@/services/product.service";
import { getBlogPostSuggestionsByIds, searchBlogPostSuggestions } from "@/services/blog.service";
import { OpenAiEmbeddingProvider } from "@/services/embedding/openai-embedding.provider";
import type { EmbeddingProvider } from "@/services/embedding/embedding-provider.interface";
import { getFoodAcademySuggestionsByIds, searchFoodAcademySuggestions } from "@/services/food-academy.service";
import { expandQuery } from "@/services/glossary.service";
import * as pricingService from "@/services/pricing.service";
import { getRecipeSuggestionsByIds, searchRecipeSuggestions } from "@/services/recipe.service";
import type { SearchSuggestionItem } from "@/services/search-extensions";
import type { ProductListItem } from "@/types/product";

/**
 * STORY-061. The full, unified, semantic-blended search used by
 * /search/page.tsx only — NOT the overlay's autocomplete, which stays
 * on the existing, untouched searchCatalogue (see
 * search.service.ts/search-extensions.ts and
 * docs/architecture-decisions.md for why the two are deliberately
 * separate code paths with separate latency budgets).
 *
 * The semantic layer is strictly additive: every keyword path below
 * runs exactly as it would without this story. If the embedding call
 * fails/times out/isn't configured, the semantic block is skipped
 * entirely and the result is the same keyword-only union
 * searchCatalogue already produces today — "transparently," per AC #7,
 * not an approximation of it.
 */

let provider: EmbeddingProvider = new OpenAiEmbeddingProvider();

/** Test-only seam — mirrors search-extensions.ts's resetSearchExtensionsForTesting shape. */
export function setSmartSearchEmbeddingProviderForTesting(nextProvider: EmbeddingProvider) {
  provider = nextProvider;
}

const PER_TYPE_LIMIT = 8;

export interface SmartSearchResults {
  query: string;
  products: ProductListItem[];
  recipes: SearchSuggestionItem[];
  blogPosts: SearchSuggestionItem[];
  foodAcademyEntries: SearchSuggestionItem[];
  /** Whether the semantic layer actually ran for this query — never shown as a UI banner (AC #7's "transparently"), but useful for the SearchQueryLog write and tests. */
  semanticLayerUsed: boolean;
  embeddingTokensUsed: number | null;
}

async function resolveProducts(ids: string[], customerGroup: CustomerGroup | undefined, limit: number): Promise<ProductListItem[]> {
  if (ids.length === 0) return [];
  const candidates = await productRepository.findProductsByIdsWithFilters(ids, {});
  const byId = new Map(candidates.map((product) => [product.id, product]));
  const resolvedPrices = await pricingService.resolvePricesForProducts(candidates.map((product) => product.id), { customerGroup: customerGroup ?? "Retail" });

  const items: ProductListItem[] = [];
  for (const id of ids) {
    const product = byId.get(id);
    if (!product) continue;
    const resolved = resolvedPrices.get(id);
    if (!resolved) continue;
    items.push(toProductListItem(product, resolved.price.toNumber(), resolved.currency));
    if (items.length >= limit) break;
  }
  return items;
}

/** Union of keyword-matched + semantic-only ids, keyword first (already proven relevant), semantic-only appended — items matched by both naturally end up at the front since they're already in the keyword list. */
function mergeIds(keywordIds: string[], semanticIds: string[]): string[] {
  const seen = new Set(keywordIds);
  const extra = semanticIds.filter((id) => !seen.has(id));
  return [...keywordIds, ...extra];
}

async function mergeContentResults(
  keywordItems: SearchSuggestionItem[],
  semanticIds: string[],
  resolveByIds: (ids: string[], limit: number) => Promise<SearchSuggestionItem[]>,
  limit: number,
): Promise<SearchSuggestionItem[]> {
  const seen = new Set(keywordItems.map((item) => item.id));
  const extraIds = semanticIds.filter((id) => !seen.has(id));
  if (extraIds.length === 0) return keywordItems.slice(0, limit);
  const extraItems = await resolveByIds(extraIds, limit);
  return [...keywordItems, ...extraItems].slice(0, limit);
}

export async function getSmartSearchResults(
  rawQuery: string,
  opts: { customerGroup?: CustomerGroup; customerId?: string | null; sessionId?: string | null } = {},
): Promise<SmartSearchResults> {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return { query: "", products: [], recipes: [], blogPosts: [], foodAcademyEntries: [], semanticLayerUsed: false, embeddingTokensUsed: null };
  }

  const expandedQuery = await expandQuery(trimmed);

  const [productMatches, recipeItems, blogItems, foodAcademyItems] = await Promise.all([
    searchRepository.findRankedProductMatches(expandedQuery),
    searchRecipeSuggestions(expandedQuery, PER_TYPE_LIMIT),
    searchBlogPostSuggestions(expandedQuery, PER_TYPE_LIMIT),
    searchFoodAcademySuggestions(expandedQuery, PER_TYPE_LIMIT),
  ]);
  const keywordProductIds = productMatches.map((match) => match.productId);

  let embeddingTokensUsed: number | null = null;
  let semanticLayerUsed = false;
  let productIds = keywordProductIds;
  let recipes = recipeItems;
  let blogPosts = blogItems;
  let foodAcademyEntries = foodAcademyItems;

  try {
    const { embedding, tokensUsed } = await provider.generateEmbedding(expandedQuery);
    embeddingTokensUsed = tokensUsed;
    semanticLayerUsed = true;

    const [similarProducts, similarRecipes, similarBlogPosts, similarFoodAcademy] = await Promise.all([
      embeddingRepository.findSimilarProductIds(embedding, PER_TYPE_LIMIT),
      embeddingRepository.findSimilarContentIds(embedding, "Recipe", PER_TYPE_LIMIT),
      embeddingRepository.findSimilarContentIds(embedding, "BlogPost", PER_TYPE_LIMIT),
      embeddingRepository.findSimilarContentIds(embedding, "FoodAcademyEntry", PER_TYPE_LIMIT),
    ]);

    productIds = mergeIds(keywordProductIds, similarProducts.map((match) => match.id));
    recipes = await mergeContentResults(recipeItems, similarRecipes.map((m) => m.id), getRecipeSuggestionsByIds, PER_TYPE_LIMIT);
    blogPosts = await mergeContentResults(blogItems, similarBlogPosts.map((m) => m.id), getBlogPostSuggestionsByIds, PER_TYPE_LIMIT);
    foodAcademyEntries = await mergeContentResults(foodAcademyItems, similarFoodAcademy.map((m) => m.id), getFoodAcademySuggestionsByIds, PER_TYPE_LIMIT);
  } catch (error) {
    // Transparent fallback (AC #7) — the semantic block simply never ran; everything above already holds the pure keyword result.
    console.error("[smart-search] semantic layer unavailable, falling back to keyword-only results", error);
  }

  const products = await resolveProducts(productIds, opts.customerGroup, PER_TYPE_LIMIT);
  const resultCount = products.length + recipes.length + blogPosts.length + foodAcademyEntries.length;

  await embeddingRepository.createSearchQueryLog({
    query: trimmed,
    resultCount,
    isZeroResult: resultCount === 0,
    embeddingTokens: embeddingTokensUsed,
    customerId: opts.customerId ?? null,
    sessionId: opts.sessionId ?? null,
  });

  return { query: trimmed, products, recipes, blogPosts, foodAcademyEntries, semanticLayerUsed, embeddingTokensUsed };
}
