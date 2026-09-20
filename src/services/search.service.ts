// src/services/search.service.ts
import * as pricingService from "@/services/pricing.service";
import * as productRepository from "@/repositories/product.repository";
import { toProductListItem } from "@/services/product.service";
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
