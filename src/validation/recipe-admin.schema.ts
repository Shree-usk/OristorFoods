import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const difficultyEnum = z.enum(["Easy", "Medium", "Hard"]);
const videoProviderEnum = z.enum(["Youtube", "Vimeo", "SelfHosted"]);

const ingredientSchema = z.object({
  quantity: z.number().nonnegative().optional().nullable(),
  unit: z.string().trim().max(30).optional().nullable(),
  displayText: z.string().trim().min(1, "Ingredient text is required.").max(200),
  productId: z.string().trim().min(1).optional().nullable(),
});

const stepSchema = z.object({
  instruction: z.string().trim().min(1, "Step instructions are required."),
  imageUrl: z.string().trim().max(2000).optional().nullable(),
});

/** Create and update share one shape — every field group editable at once, matching product-admin.schema.ts's convention. */
export const recipeAdminSchema = z.object({
  slug: z.string().trim().min(1, "Slug is required.").regex(slugRegex, "Slug must be lowercase, alphanumeric, and hyphen-separated."),
  title: z.string().trim().min(1, "Title is required.").max(200),
  shortDescription: z.string().trim().min(1, "Short description is required.").max(500),
  heroImage: z.string().trim().max(2000).optional().or(z.literal("")).nullable().transform((v) => v || ""),
  heroImageAlt: z.string().trim().max(200).optional().or(z.literal("")).nullable().transform((v) => v || ""),
  galleryImageUrls: z.array(z.string().trim().min(1)).optional().default([]),
  categoryId: z.string().trim().min(1, "Category is required."),
  cuisine: z.string().trim().max(60).optional().nullable(),
  difficulty: difficultyEnum,
  prepTimeMinutes: z.number().int().min(0),
  cookTimeMinutes: z.number().int().min(0),
  servings: z.number().int().positive(),
  isFeatured: z.boolean().optional().default(false),
  chefNotes: z.string().trim().max(2000).optional().nullable(),
  nutritionCalories: z.number().int().nonnegative().optional().nullable(),
  nutritionProtein: z.number().int().nonnegative().optional().nullable(),
  nutritionCarbs: z.number().int().nonnegative().optional().nullable(),
  nutritionFat: z.number().int().nonnegative().optional().nullable(),
  nutritionFiber: z.number().int().nonnegative().optional().nullable(),
  nutritionSodium: z.number().int().nonnegative().optional().nullable(),
  metaTitle: z.string().trim().max(70).optional().nullable(),
  metaDescription: z.string().trim().max(160).optional().nullable(),
  videoUrl: z.string().trim().max(2000).optional().or(z.literal("")).nullable(),
  videoProvider: videoProviderEnum.optional().nullable(),
  videoDurationSeconds: z.number().int().nonnegative().optional().nullable(),
  captionsUrl: z.string().trim().max(2000).optional().nullable(),
  dietaryTagIds: z.array(z.string().min(1)).optional().default([]),
  ingredients: z.array(ingredientSchema).optional().default([]),
  steps: z.array(stepSchema).optional().default([]),
});

export type RecipeAdminFormInput = z.input<typeof recipeAdminSchema>;
/** The validated shape a route handler passes to the service — totalTimeMinutes is deliberately absent; the service derives it via computeTotalTimeMinutes() so it can never drift from prep+cook (see src/lib/recipe-time.ts). */
export type RecipeAdminValidatedInput = z.output<typeof recipeAdminSchema>;

export const rejectRecipeSchema = z.object({
  comment: z.string().trim().min(1, "A comment is required so the author knows what to fix."),
});

export const listRecipesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["Draft", "Review", "Approved", "Published", "Archived"]).optional(),
  search: z.string().trim().min(1).optional(),
});
