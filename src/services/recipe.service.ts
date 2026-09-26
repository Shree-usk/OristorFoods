import type { RecipeDifficulty, RecipeStatus } from "@/generated/prisma/client";
import { computeTotalTimeMinutes } from "@/lib/recipe-time";
import * as recipeRepository from "@/repositories/recipe.repository";
import type { RecipeCardRow, RecipeDetailRow } from "@/repositories/recipe.repository";
import { registerRecipeSummaryProvider, type RecipePreview } from "@/services/product-detail-extensions";
import { registerRecipeSearchProvider, type SearchSuggestionItem } from "@/services/search-extensions";
import type { RecipeCard, RecipeDetail, RecipeFacets, RecipeIngredientItem, RecipeListResult, RecipeStepItem } from "@/types/recipe";
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
    hasVideo: row.videoUrl !== null && row.videoProvider !== null,
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

function toIngredientItem(row: RecipeDetailRow["ingredients"][number]): RecipeIngredientItem {
  return {
    id: row.id,
    quantity: row.quantity === null ? null : row.quantity.toNumber(),
    unit: row.unit,
    displayText: row.displayText,
    product: row.product,
  };
}

function toStepItem(row: RecipeDetailRow["steps"][number]): RecipeStepItem {
  return { stepNumber: row.stepNumber, instruction: row.instruction, imageUrl: row.imageUrl };
}

/** Up to `limit` other Published recipes sharing this recipe's category or cuisine. */
export async function getRelatedRecipes(recipe: RecipeDetailRow, limit = 6): Promise<RecipeCard[]> {
  const rows = await recipeRepository.findRelatedRecipes(
    { id: recipe.id, categoryId: recipe.categoryId, cuisine: recipe.cuisine },
    limit,
  );
  return rows.map(toRecipeCard);
}

export async function getRecipeBySlug(slug: string): Promise<RecipeDetail | null> {
  const row = await recipeRepository.findPublishedRecipeBySlug(slug);
  if (!row) return null;

  // Fire-and-forget: a view-count UPDATE failing must never fail the page
  // render (it's a nice-to-have popularity signal, not core content).
  const [relatedRecipes] = await Promise.all([
    getRelatedRecipes(row, 6),
    recipeRepository.incrementRecipeViewCount(row.id).catch((error: unknown) => {
      console.error(`Failed to increment view count for recipe ${row.id}`, error);
    }),
  ]);

  return {
    id: row.id,
    slug: row.slug,
    href: recipeHref(row.slug),
    title: row.title,
    shortDescription: row.shortDescription,
    heroImage: row.heroImage,
    heroImageAlt: row.heroImageAlt,
    galleryImageUrls: row.galleryImageUrls,
    categoryName: row.category.name,
    categorySlug: row.category.slug,
    cuisine: row.cuisine,
    difficulty: row.difficulty,
    prepTimeMinutes: row.prepTimeMinutes,
    cookTimeMinutes: row.cookTimeMinutes,
    totalTimeMinutes: row.totalTimeMinutes,
    servings: row.servings,
    avgRating: row.avgRating === null ? null : row.avgRating.toNumber(),
    ratingCount: row.ratingCount,
    dietaryTags: row.dietaryTags.map((link) => ({ name: link.dietaryTag.name, slug: link.dietaryTag.slug })),
    chefNotes: row.chefNotes,
    nutrition: {
      calories: row.nutritionCalories,
      protein: row.nutritionProtein,
      carbs: row.nutritionCarbs,
      fat: row.nutritionFat,
      fiber: row.nutritionFiber,
      sodium: row.nutritionSodium,
    },
    ingredients: row.ingredients.map(toIngredientItem),
    steps: row.steps.map(toStepItem),
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    relatedRecipes,
    video:
      row.videoUrl === null || row.videoProvider === null
        ? null
        : { url: row.videoUrl, provider: row.videoProvider, durationSeconds: row.videoDurationSeconds, captionsUrl: row.captionsUrl },
  };
}

/** "Recipes using this product": consumed by the PDP via getRecipeSummary(). */
export async function getRecipesByProductId(productId: string): Promise<RecipePreview[]> {
  const rows = await recipeRepository.findRecipesByProductId(productId, 6);
  return rows.map((row) => ({ id: row.id, title: row.title, slug: row.slug, imageSrc: row.heroImage }));
}

export async function getRecipesByIds(ids: string[]): Promise<RecipePreview[]> {
  if (ids.length === 0) return [];
  const rows = await recipeRepository.findRecipesByIds(ids, ids.length);
  return rows.map((row) => ({ id: row.id, title: row.title, slug: row.slug, imageSrc: row.heroImage }));
}

/** Called once from src/instrumentation.ts. */
export function registerRecipeProviders(): void {
  registerRecipeSearchProvider(searchRecipeSuggestions);
  registerRecipeSummaryProvider(async (productId) => {
    const recipes = await getRecipesByProductId(productId);
    return recipes.length > 0 ? { recipes } : null;
  });
}
