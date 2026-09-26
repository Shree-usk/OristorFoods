import * as foodAcademyRepository from "@/repositories/food-academy.repository";
import type { FoodAcademyEntryCardRow, FoodAcademyEntryDetailRow } from "@/repositories/food-academy.repository";
import { getRecipesByIds } from "@/services/recipe.service";
import { getProductsByIds } from "@/services/product.service";
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
