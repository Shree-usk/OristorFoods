import type { ContentStatus, RecipeDifficulty, RecipeStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { computeTotalTimeMinutes } from "@/lib/recipe-time";
import { createDietaryTag, createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";

let sequence = 0;

function nextNumber() {
  sequence += 1;
  return sequence;
}

interface TaxonomyOverrides {
  name?: string;
  slug?: string;
  status?: ContentStatus;
  sortOrder?: number;
}

export function makeCategory(overrides: TaxonomyOverrides = {}) {
  const n = nextNumber();
  return createRecipeCategory({
    name: overrides.name ?? `Category ${n}`,
    slug: overrides.slug ?? `category-${n}`,
    status: overrides.status,
    sortOrder: overrides.sortOrder,
  });
}

export function makeDietaryTag(overrides: TaxonomyOverrides = {}) {
  const n = nextNumber();
  return createDietaryTag({
    name: overrides.name ?? `Tag ${n}`,
    slug: overrides.slug ?? `tag-${n}`,
    status: overrides.status,
    sortOrder: overrides.sortOrder,
  });
}

export interface RecipeFixtureOverrides {
  slug?: string;
  title?: string;
  shortDescription?: string;
  cuisine?: string | null;
  difficulty?: RecipeDifficulty;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  status?: RecipeStatus;
  isFeatured?: boolean;
  viewCount?: number;
  avgRating?: number | null;
  ratingCount?: number;
  publishedAt?: Date | null;
  dietaryTagIds?: string[];
}

/** Test fixture: writes a recipe in any state directly. Defaults to Published, Easy, 30 minutes. */
export function makeRecipe(categoryId: string, overrides: RecipeFixtureOverrides = {}) {
  const n = nextNumber();
  const prep = overrides.prepTimeMinutes ?? 10;
  const cook = overrides.cookTimeMinutes ?? 20;
  return createRecipe({
    slug: overrides.slug ?? `recipe-${n}`,
    title: overrides.title ?? `Recipe ${n}`,
    shortDescription: overrides.shortDescription ?? "A test recipe.",
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: "Test hero image",
    categoryId,
    cuisine: overrides.cuisine ?? null,
    difficulty: overrides.difficulty ?? "Easy",
    prepTimeMinutes: prep,
    cookTimeMinutes: cook,
    totalTimeMinutes: computeTotalTimeMinutes(prep, cook),
    servings: 4,
    status: overrides.status ?? "Published",
    isFeatured: overrides.isFeatured ?? false,
    viewCount: overrides.viewCount ?? 0,
    avgRating: overrides.avgRating ?? null,
    ratingCount: overrides.ratingCount ?? 0,
    publishedAt: overrides.publishedAt === undefined ? new Date("2026-09-01T00:00:00Z") : overrides.publishedAt,
    dietaryTags: { create: (overrides.dietaryTagIds ?? []).map((dietaryTagId) => ({ dietaryTagId })) },
  });
}

export async function cleanupRecipes() {
  await prisma.recipe.deleteMany();
  await prisma.dietaryTag.deleteMany();
  await prisma.recipeCategory.deleteMany();
}
