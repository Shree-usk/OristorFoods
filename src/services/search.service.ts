// src/services/search.service.ts
import * as pricingService from "@/services/pricing.service";
import * as productRepository from "@/repositories/product.repository";
import * as searchRepository from "@/repositories/search.repository";
import {
  sortCandidates,
  toProductListItem,
  type ProductListingFiltersInput,
  type ProductListingResult,
  type ProductSort,
} from "@/services/product.service";
import { searchRecipes, type SearchSuggestionItem } from "@/services/search-extensions";
import type { ProductListItem } from "@/types/product";

export type { SearchSuggestionItem } from "@/services/search-extensions";

const DEFAULT_PAGE_SIZE = 12;

export interface SearchResultsPage {
  query: string;
  products: ProductListItem[];
  recipes: SearchSuggestionItem[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

function emptyResult(page: number, pageSize: number): SearchResultsPage {
  return { query: "", products: [], recipes: [], page, pageSize, hasNextPage: false };
}

export async function searchCatalogue(
  query: string,
  opts: { page?: number; pageSize?: number } = {},
): Promise<SearchResultsPage> {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
  const trimmed = query.trim();
  if (!trimmed) return emptyResult(page, pageSize);

  const skip = (page - 1) * pageSize;
  // Fetch one extra row to detect a next page without a separate COUNT
  // query — no AC requires an exact running total, and the story
  // explicitly defers full pagination UX to STORY-012.
  const [candidates, recipes] = await Promise.all([
    productRepository.searchPublishedProducts(trimmed, { take: pageSize + 1, skip }),
    searchRecipes(trimmed, pageSize),
  ]);

  const hasNextPage = candidates.length > pageSize;
  const pageCandidates = candidates.slice(0, pageSize);

  const resolvedPrices = await pricingService.resolvePricesForProducts(
    pageCandidates.map((candidate) => candidate.id),
  );

  const products: ProductListItem[] = [];
  for (const candidate of pageCandidates) {
    const resolved = resolvedPrices.get(candidate.id);
    if (!resolved) continue; // no price configured — never shown on the storefront
    products.push(toProductListItem(candidate, resolved.price.toNumber(), resolved.currency));
  }

  return { query: trimmed, products, recipes, page, pageSize, hasNextPage };
}

const DEFAULT_LISTING_PAGE_SIZE = 24;

function emptyListingResult(page: number, pageSize: number): ProductListingResult {
  return { items: [], total: 0, page, pageSize, hasNextPage: false };
}

export async function searchProducts(
  query: string,
  opts: {
    filters?: ProductListingFiltersInput;
    sort?: ProductSort;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<ProductListingResult> {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? DEFAULT_LISTING_PAGE_SIZE;
  const filters = opts.filters ?? {};
  const sort = opts.sort ?? "relevance";
  const trimmed = query.trim();
  if (!trimmed) return emptyListingResult(page, pageSize);

  const matches = await searchRepository.findRankedProductMatches(trimmed);
  if (matches.length === 0) return emptyListingResult(page, pageSize);

  const rankById = new Map(matches.map((match) => [match.productId, match]));
  const products = await productRepository.findProductsByIdsWithFilters(
    matches.map((match) => match.productId),
    {
      allergenNamesToExclude: filters.allergens,
      certificationIds: filters.certifications,
      brandSlugs: filters.brands,
      inStock: filters.inStock,
    },
  );

  const resolvedPrices = await pricingService.resolvePricesForProducts(products.map((product) => product.id));

  interface Candidate {
    product: (typeof products)[number];
    price: number;
    currency: string;
  }

  let candidates: Candidate[] = [];
  for (const product of products) {
    const resolved = resolvedPrices.get(product.id);
    if (!resolved) continue; // no price configured — never shown on the storefront
    candidates.push({ product, price: resolved.price.toNumber(), currency: resolved.currency });
  }

  if (filters.priceMin !== undefined) {
    const min = filters.priceMin;
    candidates = candidates.filter((candidate) => candidate.price >= min);
  }
  if (filters.priceMax !== undefined) {
    const max = filters.priceMax;
    candidates = candidates.filter((candidate) => candidate.price <= max);
  }

  if (sort === "relevance") {
    candidates.sort((a, b) => {
      const rankA = rankById.get(a.product.id)!;
      const rankB = rankById.get(b.product.id)!;
      if (rankB.rankTier !== rankA.rankTier) return rankB.rankTier - rankA.rankTier;
      return rankB.similarity - rankA.similarity;
    });
  } else {
    candidates = sortCandidates(candidates, sort);
  }

  const total = candidates.length;
  const start = (page - 1) * pageSize;
  const pageCandidates = candidates.slice(start, start + pageSize);

  const items = pageCandidates.map(({ product, price, currency }) =>
    toProductListItem(product, price, currency),
  );

  if (trimmed) logProductSearch({ query: trimmed, resultCount: total });

  return { items, total, page, pageSize, hasNextPage: start + pageSize < total };
}

const DEFAULT_SUGGESTION_LIMIT = 8;
const SUGGESTION_MIN_TIER = 2; // exclude tier-1 (description/ingredient-only) matches — a suggestion dropdown should look obviously relevant

export interface SearchSuggestion {
  id: string;
  label: string;
  href: string;
  type: "Product";
}

export async function getSearchSuggestions(
  query: string,
  limit: number = DEFAULT_SUGGESTION_LIMIT,
): Promise<SearchSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const matches = await searchRepository.findRankedProductMatches(trimmed);
  const relevant = matches.filter((match) => match.rankTier >= SUGGESTION_MIN_TIER).slice(0, limit);
  if (relevant.length === 0) return [];

  const rankOrder = new Map(relevant.map((match, index) => [match.productId, index]));
  const products = await productRepository.findProductsByIdsWithFilters(
    relevant.map((match) => match.productId),
    {},
  );
  const sorted = [...products].sort(
    (a, b) => (rankOrder.get(a.id) ?? 0) - (rankOrder.get(b.id) ?? 0),
  );

  return sorted.map((product) => ({
    id: product.id,
    label: product.name,
    href: `/products/${product.slug}`,
    type: "Product" as const,
  }));
}

export function findDidYouMeanSuggestion(query: string): Promise<string | null> {
  return searchRepository.findClosestNameSuggestion(query);
}

/**
 * Typed hook point for future analytics/AI consumption (STORY-061 AI
 * Smart Search, STORY-064 AI Business Insights) — no UI, no queue, just a
 * call site those stories can redirect to a real sink. Logs outside
 * production only, matching src/lib/db.ts's existing
 * NODE_ENV-gated-logging convention — there's no real sink yet.
 */
export function logProductSearch(event: { query: string; resultCount: number }): void {
  if (process.env.NODE_ENV !== "production") {
    console.debug("[search] product search logged", event);
  }
}
