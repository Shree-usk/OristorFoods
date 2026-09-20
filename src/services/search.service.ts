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

  return { items, total, page, pageSize, hasNextPage: start + pageSize < total };
}
