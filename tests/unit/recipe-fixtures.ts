import type {
  ContentStatus,
  CookingTipStatus,
  RecipeDifficulty,
  RecipeStatus,
  VideoProvider,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { computeTotalTimeMinutes } from "@/lib/recipe-time";
import { createCookingTip } from "@/repositories/cooking-tip.repository";
import { createFoodAcademyEntry } from "@/repositories/food-academy.repository";
import { createDietaryTag, createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";
import type { RecipeDetail } from "@/types/recipe";

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

export interface RecipeIngredientOverride {
  productId?: string;
  quantity?: number;
  unit?: string;
  displayText: string;
  sortOrder?: number;
}

export interface RecipeStepOverride {
  stepNumber: number;
  instruction: string;
  imageUrl?: string;
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
  ingredients?: RecipeIngredientOverride[];
  steps?: RecipeStepOverride[];
  videoUrl?: string | null;
  videoProvider?: VideoProvider | null;
  videoDurationSeconds?: number | null;
  captionsUrl?: string | null;
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
    videoUrl: overrides.videoUrl ?? null,
    videoProvider: overrides.videoProvider ?? null,
    videoDurationSeconds: overrides.videoDurationSeconds ?? null,
    captionsUrl: overrides.captionsUrl ?? null,
    dietaryTags: { create: (overrides.dietaryTagIds ?? []).map((dietaryTagId) => ({ dietaryTagId })) },
    ingredients: {
      create: (overrides.ingredients ?? []).map((ingredient, index) => ({
        productId: ingredient.productId,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        displayText: ingredient.displayText,
        sortOrder: ingredient.sortOrder ?? index,
      })),
    },
    steps: { create: overrides.steps ?? [] },
  });
}

/**
 * Plain in-memory `RecipeDetail` builder — no Prisma, no DB access.
 * For Client Component / view tests that just need a well-formed object
 * to pass as a prop (unlike `makeRecipe`, which writes a row for
 * repository/service/route tests). Every field has a sane default;
 * override any subset.
 */
export function buildRecipeDetail(overrides: Partial<RecipeDetail> = {}): RecipeDetail {
  return {
    id: "recipe-1",
    slug: "test-recipe",
    href: "/recipes/test-recipe",
    title: "Test Recipe",
    shortDescription: "A short description of the test recipe.",
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: "Test hero image",
    galleryImageUrls: [],
    categoryName: "Curries",
    categorySlug: "curries",
    cuisine: "Sri Lankan",
    difficulty: "Easy",
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: 30,
    servings: 4,
    avgRating: null,
    ratingCount: 0,
    dietaryTags: [],
    chefNotes: null,
    nutrition: {
      calories: 250,
      protein: 10,
      carbs: 30,
      fat: 8,
      fiber: 4,
      sodium: 400,
    },
    ingredients: [{ id: "ing-1", quantity: 2, unit: "cup", displayText: "Rice", product: null }],
    steps: [{ stepNumber: 1, instruction: "Do the thing.", imageUrl: null }],
    metaTitle: null,
    metaDescription: null,
    publishedAt: "2026-09-01T00:00:00.000Z",
    relatedRecipes: [],
    video: null,
    ...overrides,
  };
}

export interface CookingTipFixtureOverrides {
  slug?: string;
  title?: string;
  summary?: string;
  bodyContent?: string;
  videoUrl?: string | null;
  videoProvider?: VideoProvider | null;
  imageUrl?: string | null;
  topicTag?: string;
  status?: CookingTipStatus;
  publishedAt?: Date | null;
  productIds?: string[];
}

/** Test fixture: writes a cooking tip in any state directly. Defaults to Published, topic "general". */
export function makeCookingTip(overrides: CookingTipFixtureOverrides = {}) {
  const n = nextNumber();
  return createCookingTip({
    slug: overrides.slug ?? `cooking-tip-${n}`,
    title: overrides.title ?? `Cooking Tip ${n}`,
    summary: overrides.summary ?? "A test cooking tip.",
    bodyContent: overrides.bodyContent ?? "Body content.",
    videoUrl: overrides.videoUrl ?? null,
    videoProvider: overrides.videoProvider ?? null,
    imageUrl: overrides.imageUrl ?? "/images/products/export/curry-powder.webp",
    topicTag: overrides.topicTag ?? "general",
    status: overrides.status ?? "Published",
    publishedAt: overrides.publishedAt === undefined ? new Date("2026-09-01T00:00:00Z") : overrides.publishedAt,
    productRefs: { create: (overrides.productIds ?? []).map((productId) => ({ productId })) },
  });
}

export interface FoodAcademyCategoryOverrides {
  name?: string;
  slug?: string;
  status?: ContentStatus;
}

export function makeFoodAcademyCategory(overrides: FoodAcademyCategoryOverrides = {}) {
  const n = nextNumber();
  return prisma.foodAcademyCategory.create({
    data: {
      name: overrides.name ?? `Category ${n}`,
      slug: overrides.slug ?? `fa-category-${n}`,
      status: overrides.status ?? "Active",
    },
  });
}

export interface FoodAcademyEntryOverrides {
  slug?: string;
  title?: string;
  summary?: string;
  contentType?: "Article" | "Guide" | "Course";
  categoryId: string;
  bodyContent?: string | null;
  isFeatured?: boolean;
  status?: "Draft" | "Published";
  publishedAt?: Date | null;
  recipeIds?: string[];
  productIds?: string[];
  sections?: { sectionNumber: number; title: string; bodyContent: string }[];
}

export function makeFoodAcademyEntry(overrides: FoodAcademyEntryOverrides) {
  const n = nextNumber();
  return createFoodAcademyEntry({
    slug: overrides.slug ?? `fa-entry-${n}`,
    title: overrides.title ?? `Entry ${n}`,
    summary: overrides.summary ?? "A test entry.",
    contentType: overrides.contentType ?? "Article",
    categoryId: overrides.categoryId,
    bodyContent: overrides.bodyContent === undefined ? "Body content." : overrides.bodyContent,
    isFeatured: overrides.isFeatured ?? false,
    status: overrides.status ?? "Published",
    publishedAt: overrides.publishedAt === undefined ? new Date("2026-09-01T00:00:00Z") : overrides.publishedAt,
    recipeRefs: { create: (overrides.recipeIds ?? []).map((recipeId) => ({ recipeId })) },
    productRefs: { create: (overrides.productIds ?? []).map((productId) => ({ productId })) },
    sections: { create: overrides.sections ?? [] },
  });
}

export async function cleanupRecipes() {
  // FoodAcademyEntry deletes before FoodAcademyCategory (categoryId has no
  // cascade, so leftover entries would block a category delete) and before
  // recipe/product cleanup (their refs point at Recipe/Product). Sections
  // and refs cascade-delete with their parent FoodAcademyEntry, but are
  // listed explicitly to match this file's one-line-per-table style.
  await prisma.foodAcademySection.deleteMany();
  await prisma.foodAcademyRecipeRef.deleteMany();
  await prisma.foodAcademyProductRef.deleteMany();
  await prisma.foodAcademyEntry.deleteMany();
  await prisma.foodAcademyCategory.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.dietaryTag.deleteMany();
  await prisma.recipeCategory.deleteMany();
  await prisma.cookingTip.deleteMany();
}
