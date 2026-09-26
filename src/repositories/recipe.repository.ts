import type { Prisma, RecipeDifficulty } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { escapeLikePattern } from "@/lib/escape-like-pattern";
import type { RecipeDifficultyParam, RecipeFilters, RecipeSort, RecipeTimeRange } from "@/lib/recipe-listing-values";

const difficultyByParam: Record<RecipeDifficultyParam, RecipeDifficulty> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

// Half-open, so a boundary value (15, 30, 60) falls into exactly one range.
const timeRangeBounds: Record<RecipeTimeRange, Prisma.IntFilter> = {
  "under-15": { lt: 15 },
  "15-30": { gte: 15, lt: 30 },
  "30-60": { gte: 30, lt: 60 },
  "60-plus": { gte: 60 },
};

function searchWords(q: string | undefined): string[] {
  return (q ?? "").split(/\s+/).filter(Boolean);
}

/**
 * The storefront's single recipe filter. Pure, so it's unit-testable without
 * a database. The first condition is always `status: "Published"`: nothing
 * else in the storefront can widen it.
 */
export function buildRecipeWhere(filters: RecipeFilters): { AND: Prisma.RecipeWhereInput[] } {
  const and: Prisma.RecipeWhereInput[] = [{ status: "Published" }];

  if (filters.category) {
    and.push({ category: { is: { slug: filters.category, status: "Active" } } });
  }
  if (filters.difficulty && filters.difficulty.length > 0) {
    and.push({ difficulty: { in: filters.difficulty.map((param) => difficultyByParam[param]) } });
  }
  if (filters.time && filters.time.length > 0) {
    and.push({ OR: filters.time.map((range) => ({ totalTimeMinutes: timeRangeBounds[range] })) });
  }
  for (const slug of filters.diet ?? []) {
    and.push({ dietaryTags: { some: { dietaryTag: { slug, status: "Active" } } } });
  }
  if (filters.hasVideo) {
    and.push({ videoUrl: { not: null } });
  }
  for (const word of searchWords(filters.q)) {
    const escaped = escapeLikePattern(word);
    and.push({
      OR: [
        { title: { contains: escaped, mode: "insensitive" } },
        { shortDescription: { contains: escaped, mode: "insensitive" } },
      ],
    });
  }

  return { AND: and };
}

/** Every sort ends with `id` so pagination never repeats or skips a recipe. */
export function buildRecipeOrderBy(sort: RecipeSort): Prisma.RecipeOrderByWithRelationInput[] {
  switch (sort) {
    case "popular":
      return [{ viewCount: "desc" }, { id: "asc" }];
    case "rating":
      return [{ avgRating: { sort: "desc", nulls: "last" } }, { ratingCount: "desc" }, { id: "asc" }];
    case "time":
      return [{ totalTimeMinutes: "asc" }, { id: "asc" }];
    case "newest":
      return [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }];
  }
}

export const recipeCardSelect = {
  id: true,
  slug: true,
  title: true,
  heroImage: true,
  heroImageAlt: true,
  cuisine: true,
  difficulty: true,
  totalTimeMinutes: true,
  avgRating: true,
  ratingCount: true,
  videoUrl: true,
  videoProvider: true,
  category: { select: { name: true } },
  dietaryTags: {
    where: { dietaryTag: { status: "Active" } },
    orderBy: { dietaryTag: { sortOrder: "asc" } },
    select: { dietaryTag: { select: { name: true } } },
  },
} satisfies Prisma.RecipeSelect;

export type RecipeCardRow = Prisma.RecipeGetPayload<{ select: typeof recipeCardSelect }>;

export async function findPublishedRecipes(args: {
  where: Prisma.RecipeWhereInput;
  orderBy: Prisma.RecipeOrderByWithRelationInput[];
  skip: number;
  take: number;
}): Promise<{ rows: RecipeCardRow[]; total: number }> {
  const [rows, total] = await prisma.$transaction([
    prisma.recipe.findMany({
      where: args.where,
      orderBy: args.orderBy,
      skip: args.skip,
      take: args.take,
      select: recipeCardSelect,
    }),
    prisma.recipe.count({ where: args.where }),
  ]);
  return { rows, total };
}

const facetOrder = [{ sortOrder: "asc" as const }, { name: "asc" as const }];

/** Admins can create categories ahead of content; empty ones stay off the storefront. */
export function findActiveCategoriesWithPublishedRecipes() {
  return prisma.recipeCategory.findMany({
    where: { status: "Active", recipes: { some: { status: "Published" } } },
    orderBy: facetOrder,
    select: { name: true, slug: true },
  });
}

export function findActiveDietaryTagsWithPublishedRecipes() {
  return prisma.dietaryTag.findMany({
    where: { status: "Active", recipes: { some: { recipe: { status: "Published" } } } },
    orderBy: facetOrder,
    select: { name: true, slug: true },
  });
}

export function findFeaturedRecipes(limit: number) {
  return prisma.recipe.findMany({
    where: { status: "Published", isFeatured: true },
    orderBy: buildRecipeOrderBy("newest"),
    take: limit,
    select: recipeCardSelect,
  });
}

export const recipeDetailSelect = {
  id: true,
  slug: true,
  title: true,
  shortDescription: true,
  heroImage: true,
  heroImageAlt: true,
  galleryImageUrls: true,
  categoryId: true,
  cuisine: true,
  difficulty: true,
  prepTimeMinutes: true,
  cookTimeMinutes: true,
  totalTimeMinutes: true,
  servings: true,
  avgRating: true,
  ratingCount: true,
  chefNotes: true,
  nutritionCalories: true,
  nutritionProtein: true,
  nutritionCarbs: true,
  nutritionFat: true,
  nutritionFiber: true,
  nutritionSodium: true,
  metaTitle: true,
  metaDescription: true,
  publishedAt: true,
  videoUrl: true,
  videoProvider: true,
  videoDurationSeconds: true,
  captionsUrl: true,
  category: { select: { name: true, slug: true } },
  dietaryTags: {
    where: { dietaryTag: { status: "Active" } },
    orderBy: { dietaryTag: { sortOrder: "asc" } },
    select: { dietaryTag: { select: { name: true, slug: true } } },
  },
  ingredients: {
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      quantity: true,
      unit: true,
      displayText: true,
      product: { select: { id: true, slug: true, name: true } },
    },
  },
  steps: {
    orderBy: { stepNumber: "asc" },
    select: { id: true, stepNumber: true, instruction: true, imageUrl: true },
  },
} satisfies Prisma.RecipeSelect;

export type RecipeDetailRow = Prisma.RecipeGetPayload<{ select: typeof recipeDetailSelect }>;

export function findPublishedRecipeBySlug(slug: string): Promise<RecipeDetailRow | null> {
  return prisma.recipe.findFirst({
    where: { slug, status: "Published" },
    select: recipeDetailSelect,
  });
}

export function findRelatedRecipes(
  recipe: { id: string; categoryId: string; cuisine: string | null },
  limit: number,
): Promise<RecipeCardRow[]> {
  return prisma.recipe.findMany({
    where: {
      status: "Published",
      id: { not: recipe.id },
      OR: [{ categoryId: recipe.categoryId }, ...(recipe.cuisine ? [{ cuisine: recipe.cuisine }] : [])],
    },
    orderBy: buildRecipeOrderBy("popular"),
    take: limit,
    select: recipeCardSelect,
  });
}

export function findRecipesByProductId(productId: string, limit: number): Promise<RecipeCardRow[]> {
  return prisma.recipe.findMany({
    where: { status: "Published", ingredients: { some: { productId } } },
    orderBy: buildRecipeOrderBy("popular"),
    take: limit,
    select: recipeCardSelect,
  });
}

export function findRecipesByIds(ids: string[], limit: number): Promise<RecipeCardRow[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return prisma.recipe.findMany({
    where: { status: "Published", id: { in: ids } },
    orderBy: buildRecipeOrderBy("popular"),
    take: limit,
    select: recipeCardSelect,
  });
}

/**
 * Raw UPDATE rather than `prisma.recipe.update` so `@updatedAt` isn't
 * touched by a view — a page view is not a content edit.
 */
export async function incrementRecipeViewCount(recipeId: string): Promise<void> {
  await prisma.$executeRaw`UPDATE "Recipe" SET "viewCount" = "viewCount" + 1 WHERE "id" = ${recipeId}`;
}

// Writes. Used by the seed and tests now; STORY-043's admin builder later.

export function createRecipeCategory(data: Prisma.RecipeCategoryCreateInput) {
  return prisma.recipeCategory.create({ data });
}

export function createDietaryTag(data: Prisma.DietaryTagCreateInput) {
  return prisma.dietaryTag.create({ data });
}

export function createRecipe(data: Prisma.RecipeUncheckedCreateInput) {
  return prisma.recipe.create({ data });
}
