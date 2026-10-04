import * as foodAcademyRepository from "@/repositories/food-academy.repository";
import type { FoodAcademyEntryCardRow, FoodAcademyEntryDetailRow } from "@/repositories/food-academy.repository";
import { getRecipesByIds } from "@/services/recipe.service";
import { getProductsByIds } from "@/services/product.service";
import { registerFoodAcademySearchProvider, type SearchSuggestionItem } from "@/services/search-extensions";
import type { FoodAcademyEntryCard, FoodAcademyEntryDetail, FoodAcademyListResult } from "@/types/food-academy";
import type { FoodAcademyListQuery } from "@/validation/food-academy.schema";

function entryHref(slug: string): string {
  return `/food-academy/${slug}`;
}

function toEntryCard(row: FoodAcademyEntryCardRow): FoodAcademyEntryCard {
  return {
    id: row.id,
    slug: row.slug,
    href: entryHref(row.slug),
    title: row.title,
    summary: row.summary,
    heroImageUrl: row.heroImageUrl,
    contentType: row.contentType,
    categoryName: row.category.name,
    categorySlug: row.category.slug,
    readingTimeMinutes: row.readingTimeMinutes,
    isFeatured: row.isFeatured,
  };
}

export async function listEntries(query: FoodAcademyListQuery): Promise<FoodAcademyListResult> {
  const { page, pageSize, category, contentType } = query;
  const where = {
    ...(category ? { category: { slug: category } } : {}),
    ...(contentType ? { contentType } : {}),
  };
  const { rows, total } = await foodAcademyRepository.findPublishedFoodAcademyEntries({
    where,
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return { entries: rows.map(toEntryCard), total, page, pageSize };
}

export async function listFeaturedEntries(limit = 4): Promise<FoodAcademyEntryCard[]> {
  const rows = await foodAcademyRepository.findFeaturedFoodAcademyEntries(limit);
  return rows.map(toEntryCard);
}

export function listCategories() {
  return foodAcademyRepository.findActiveFoodAcademyCategories();
}

export async function getEntryBySlug(slug: string): Promise<FoodAcademyEntryDetail | null> {
  const row: FoodAcademyEntryDetailRow | null = await foodAcademyRepository.findPublishedFoodAcademyEntryBySlug(slug);
  if (!row) return null;

  const [relatedEntryRows, relatedRecipes, relatedProducts] = await Promise.all([
    foodAcademyRepository.findRelatedFoodAcademyEntries({ id: row.id, categoryId: row.categoryId }, 6),
    getRecipesByIds(row.recipeRefs.map((ref) => ref.recipeId)),
    getProductsByIds(row.productRefs.map((ref) => ref.productId)),
  ]);

  return {
    ...toEntryCard(row),
    bodyContent: row.bodyContent,
    authorName: row.authorName,
    sections: row.sections,
    relatedRecipes,
    relatedProducts,
    relatedEntries: relatedEntryRows.map(toEntryCard),
  };
}

function toFoodAcademySuggestionItem(row: FoodAcademyEntryCardRow): SearchSuggestionItem {
  return { id: row.id, label: row.title, href: entryHref(row.slug), imageSrc: row.heroImageUrl ?? undefined, type: "FoodAcademyEntry" };
}

// STORY-061. Keyword-only (ILIKE) — the AI Smart Search fallback
// path, same shape as recipe.service.ts::searchRecipeSuggestions.
export async function searchFoodAcademySuggestions(query: string, limit: number): Promise<SearchSuggestionItem[]> {
  const q = query.trim();
  if (!q) return [];
  const { rows } = await foodAcademyRepository.findPublishedFoodAcademyEntries({
    where: { OR: [{ title: { contains: q, mode: "insensitive" } }, { summary: { contains: q, mode: "insensitive" } }] },
    skip: 0,
    take: limit,
  });
  return rows.map(toFoodAcademySuggestionItem);
}

/** STORY-061. Resolves a candidate id list (e.g. vector-similarity matches) to the same suggestion shape — published-only via findPublishedFoodAcademyEntries. */
export async function getFoodAcademySuggestionsByIds(ids: string[], limit: number): Promise<SearchSuggestionItem[]> {
  if (ids.length === 0) return [];
  const { rows } = await foodAcademyRepository.findPublishedFoodAcademyEntries({ where: { id: { in: ids } }, skip: 0, take: limit });
  return rows.map(toFoodAcademySuggestionItem);
}

export function registerFoodAcademyProviders(): void {
  registerFoodAcademySearchProvider(searchFoodAcademySuggestions);
}
