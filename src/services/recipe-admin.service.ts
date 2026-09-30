import { Prisma, type RecipeStatus } from "@/generated/prisma/client";
import * as recipeRepository from "@/repositories/recipe.repository";
import type { RecipeAdminDetail, RecipeAdminListFilters, RecipeAdminWriteInput } from "@/repositories/recipe.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { requirePermission } from "@/services/permission.service";
import {
  RecipeAdminIllegalTransitionError,
  RecipeAdminNotDraftError,
  RecipeAdminNotFoundError,
  RecipeAdminSlugConflictError,
  RecipePublishReadinessError,
} from "@/services/recipe-admin.errors";
import type { RecipeAdminValidatedInput } from "@/validation/recipe-admin.schema";
import { computeTotalTimeMinutes } from "@/lib/recipe-time";
import { toRecipeDetail } from "@/services/recipe.service";
import type { RecipeDetail } from "@/types/recipe";

function toWriteInput(input: RecipeAdminValidatedInput): RecipeAdminWriteInput {
  return { ...input, totalTimeMinutes: computeTotalTimeMinutes(input.prepTimeMinutes, input.cookTimeMinutes) };
}

/**
 * STORY-043. Built directly on `Recipe.status` rather than STORY-053's
 * shared CMS workflow engine — that story doesn't exist yet, and every
 * other admin module so far (Products, Homepage Builder) built its own
 * lightweight transition guard instead of waiting for one. See
 * docs/architecture-decisions.md.
 */
const ALLOWED_TRANSITIONS: Record<RecipeStatus, RecipeStatus[]> = {
  Draft: ["Review"],
  Review: ["Approved", "Draft"],
  Approved: ["Published", "Draft"],
  Published: ["Archived"],
  Archived: ["Draft"],
};

function isUniqueConstraintViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Mirrors product-admin.service.ts's conflictField — the @prisma/adapter-pg driver reports a P2002's violated column(s) under meta.driverAdapterError.cause.constraint.fields, not the classic meta.target shape. */
function conflictField(error: Prisma.PrismaClientKnownRequestError): string | undefined {
  const meta = error.meta as { target?: unknown; driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } } } | undefined;
  const adapterFields = meta?.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(adapterFields) && typeof adapterFields[0] === "string") return adapterFields[0];
  const target = meta?.target;
  if (Array.isArray(target)) return target[0] as string;
  if (typeof target === "string") return target;
  return undefined;
}

function mapWriteError(error: unknown, slug: string): never {
  if (isUniqueConstraintViolation(error) && conflictField(error) === "slug") throw new RecipeAdminSlugConflictError(slug);
  throw error;
}

async function requireRecipe(id: string): Promise<RecipeAdminDetail> {
  const recipe = await recipeRepository.findRecipeAdminDetailById(id);
  if (!recipe) throw new RecipeAdminNotFoundError();
  return recipe;
}

/** AC: nothing reaches Review/Published without a hero image, at least one ingredient, and at least one step. */
function assertPublishReady(recipe: Pick<RecipeAdminDetail, "heroImage" | "heroImageAlt" | "ingredients" | "steps">): void {
  const missing: string[] = [];
  if (!recipe.heroImage || !recipe.heroImageAlt) missing.push("a hero image with alt text");
  if (recipe.ingredients.length === 0) missing.push("at least one ingredient");
  if (recipe.steps.length === 0) missing.push("at least one step");
  if (missing.length > 0) throw new RecipePublishReadinessError(missing);
}

export async function getRecipeFormReferenceData(adminUserId: string) {
  await requirePermission(adminUserId, "Recipes", "View");
  const [categories, dietaryTags] = await Promise.all([recipeRepository.listAllRecipeCategoriesForAdmin(), recipeRepository.listAllDietaryTagsForAdmin()]);
  return { categories, dietaryTags };
}

export async function listRecipesForAdmin(adminUserId: string, filters: RecipeAdminListFilters, page: number, pageSize: number) {
  await requirePermission(adminUserId, "Recipes", "View");
  return recipeRepository.listRecipesForAdmin(filters, page, pageSize);
}

export async function getRecipeForAdmin(adminUserId: string, id: string): Promise<RecipeAdminDetail> {
  await requirePermission(adminUserId, "Recipes", "View");
  return requireRecipe(id);
}

/**
 * Admin-only preview: any status, not just Published — reuses
 * recipe.service.ts's exact toRecipeDetail() transformation so the
 * preview render (and the real storefront page it's rendered through)
 * can never structurally drift apart. Related recipes are skipped
 * (empty array), matching getRecipeForExport()'s precedent for a
 * non-page-view read of a recipe.
 */
export async function getRecipeForPreview(adminUserId: string, id: string): Promise<RecipeDetail> {
  await requirePermission(adminUserId, "Recipes", "View");
  const row = await recipeRepository.findRecipeAdminDetailById(id);
  if (!row) throw new RecipeAdminNotFoundError();
  return toRecipeDetail(row, []);
}

export async function createRecipe(adminUserId: string, input: RecipeAdminValidatedInput): Promise<RecipeAdminDetail> {
  await requirePermission(adminUserId, "Recipes", "Edit");
  try {
    const created = await recipeRepository.createRecipeAdmin(toWriteInput(input), adminUserId);
    await writeAuditLog({ actorId: adminUserId, action: "recipe_created", module: "Recipes", targetType: "Recipe", targetId: created.id });
    return created;
  } catch (error) {
    mapWriteError(error, input.slug);
  }
}

export async function updateRecipe(adminUserId: string, id: string, input: RecipeAdminValidatedInput): Promise<RecipeAdminDetail> {
  await requirePermission(adminUserId, "Recipes", "Edit");
  await requireRecipe(id);
  try {
    const updated = await recipeRepository.updateRecipeAdmin(id, toWriteInput(input), adminUserId);
    await writeAuditLog({ actorId: adminUserId, action: "recipe_updated", module: "Recipes", targetType: "Recipe", targetId: id });
    return updated;
  } catch (error) {
    mapWriteError(error, input.slug);
  }
}

/** Only a Draft recipe may be deleted — anything that's entered the review workflow is real history, not scratch state. */
export async function deleteRecipe(adminUserId: string, id: string): Promise<void> {
  await requirePermission(adminUserId, "Recipes", "Delete");
  const recipe = await requireRecipe(id);
  if (recipe.status !== "Draft") throw new RecipeAdminNotDraftError();

  await recipeRepository.deleteRecipeById(id);
  await writeAuditLog({ actorId: adminUserId, action: "recipe_deleted", module: "Recipes", targetType: "Recipe", targetId: id });
}

async function transition(adminUserId: string, id: string, to: RecipeStatus, extra: { publishedAt?: Date | null; reviewerComment?: string | null; reviewedById?: string | null } = {}): Promise<RecipeAdminDetail> {
  const recipe = await requireRecipe(id);
  if (!ALLOWED_TRANSITIONS[recipe.status].includes(to)) throw new RecipeAdminIllegalTransitionError(recipe.status, to);

  const updated = await recipeRepository.updateRecipeStatus(id, { status: to, ...extra });
  await writeAuditLog({ actorId: adminUserId, action: "recipe_status_changed", module: "Recipes", targetType: "Recipe", targetId: id, metadata: { from: recipe.status, to } });
  return updated;
}

export async function submitForReview(adminUserId: string, id: string): Promise<RecipeAdminDetail> {
  await requirePermission(adminUserId, "Recipes", "Edit");
  const recipe = await requireRecipe(id);
  assertPublishReady(recipe);
  return transition(adminUserId, id, "Review", { reviewerComment: null });
}

/** Gated by "Approve", not "Edit" — the AC's review step is a distinct capability from ordinary content editing. */
export async function approve(adminUserId: string, id: string): Promise<RecipeAdminDetail> {
  await requirePermission(adminUserId, "Recipes", "Approve");
  return transition(adminUserId, id, "Approved", { reviewedById: adminUserId, reviewerComment: null });
}

/** A reviewer can reject from Review or Approved (still catching something before it's live) — always back to Draft, always with a comment the author sees. */
export async function reject(adminUserId: string, id: string, comment: string): Promise<RecipeAdminDetail> {
  await requirePermission(adminUserId, "Recipes", "Approve");
  return transition(adminUserId, id, "Draft", { reviewedById: adminUserId, reviewerComment: comment });
}

export async function publish(adminUserId: string, id: string): Promise<RecipeAdminDetail> {
  await requirePermission(adminUserId, "Recipes", "Approve");
  const recipe = await requireRecipe(id);
  assertPublishReady(recipe);
  return transition(adminUserId, id, "Published", { publishedAt: new Date() });
}

export async function archive(adminUserId: string, id: string): Promise<RecipeAdminDetail> {
  await requirePermission(adminUserId, "Recipes", "Edit");
  return transition(adminUserId, id, "Archived");
}

export async function restore(adminUserId: string, id: string): Promise<RecipeAdminDetail> {
  await requirePermission(adminUserId, "Recipes", "Edit");
  return transition(adminUserId, id, "Draft");
}
