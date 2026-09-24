import type { RecipeDifficulty, RecipeStatus } from "@/generated/prisma/client";
import { computeTotalTimeMinutes } from "@/lib/recipe-time";
import * as recipeRepository from "@/repositories/recipe.repository";
import type { RecipeCardRow } from "@/repositories/recipe.repository";
import { registerRecipeSearchProvider, type SearchSuggestionItem } from "@/services/search-extensions";
import type { RecipeCard, RecipeFacets, RecipeListResult } from "@/types/recipe";
import type { RecipeListingQuery } from "@/validation/recipe-listing.schema";

function recipeHref(slug: string) {
  return `/recipes/${slug}`;
}

function toRecipeCard(row: RecipeCardRow): RecipeCard {
  return {
    id: row.id,
    slug: row.slug,
    href: recipeHref(row.slug),
    title: row.title,
    heroImage: row.heroImage,
    heroImageAlt: row.heroImageAlt,
    categoryName: row.category.name,
    cuisine: row.cuisine,
    difficulty: row.difficulty,
    totalTimeMinutes: row.totalTimeMinutes,
    avgRating: row.avgRating === null ? null : row.avgRating.toNumber(),
    ratingCount: row.ratingCount,
    dietaryTags: row.dietaryTags.map((link) => link.dietaryTag.name),
  };
}

export async function listRecipes(query: RecipeListingQuery): Promise<RecipeListResult> {
  const { page, pageSize, sort, ...filters } = query;
  const { rows, total } = await recipeRepository.findPublishedRecipes({
    where: recipeRepository.buildRecipeWhere(filters),
    orderBy: recipeRepository.buildRecipeOrderBy(sort),
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return { recipes: rows.map(toRecipeCard), total, page, pageSize };
}

export async function listRecipeFacets(): Promise<RecipeFacets> {
  const [categories, dietaryTags] = await Promise.all([
    recipeRepository.findActiveCategoriesWithPublishedRecipes(),
    recipeRepository.findActiveDietaryTagsWithPublishedRecipes(),
  ]);
  return { categories, dietaryTags };
}

/** Homepage "Featured Recipes": admins flag recipes with isFeatured. */
export async function getFeaturedRecipes(limit = 4): Promise<RecipeCard[]> {
  const rows = await recipeRepository.findFeaturedRecipes(limit);
  return rows.map(toRecipeCard);
}

export interface NewRecipeInput {
  slug: string;
  title: string;
  shortDescription: string;
  heroImage: string;
  heroImageAlt: string;
  categoryId: string;
  cuisine?: string | null;
  difficulty: RecipeDifficulty;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  status?: RecipeStatus;
  isFeatured?: boolean;
  viewCount?: number;
  avgRating?: number | null;
  ratingCount?: number;
  publishedAt?: Date | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  dietaryTagIds?: string[];
}

/** Used by the seed now and by STORY-043's admin builder later. */
export function createRecipe(input: NewRecipeInput) {
  const { dietaryTagIds = [], ...fields } = input;
  return recipeRepository.createRecipe({
    ...fields,
    totalTimeMinutes: computeTotalTimeMinutes(fields.prepTimeMinutes, fields.cookTimeMinutes),
    dietaryTags: { create: dietaryTagIds.map((dietaryTagId) => ({ dietaryTagId })) },
  });
}

/** Header search suggestions: same title/description match as the listing, most viewed first. */
export async function searchRecipeSuggestions(query: string, limit: number): Promise<SearchSuggestionItem[]> {
  const q = query.trim();
  if (!q) return [];
  const { rows } = await recipeRepository.findPublishedRecipes({
    where: recipeRepository.buildRecipeWhere({ q }),
    orderBy: recipeRepository.buildRecipeOrderBy("popular"),
    skip: 0,
    take: limit,
  });
  return rows.map((row) => ({
    id: row.id,
    label: row.title,
    href: recipeHref(row.slug),
    imageSrc: row.heroImage,
    type: "Recipe",
  }));
}

/** Called once from src/instrumentation.ts. */
export function registerRecipeProviders(): void {
  registerRecipeSearchProvider(searchRecipeSuggestions);
}
