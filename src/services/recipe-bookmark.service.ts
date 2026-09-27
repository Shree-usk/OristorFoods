import { Prisma } from "@/generated/prisma/client";
import { findPublishedRecipeBySlug, findRecipesByIds } from "@/repositories/recipe.repository";
import * as recipeBookmarkRepository from "@/repositories/recipe-bookmark.repository";
import { RecipeNotFoundError } from "@/services/recipe-bookmark.errors";
import { toRecipeCard } from "@/services/recipe.service";
import type { RecipeCard } from "@/types/recipe";

async function requirePublishedRecipe(slug: string) {
  const recipe = await findPublishedRecipeBySlug(slug);
  if (!recipe) throw new RecipeNotFoundError();
  return recipe;
}

export async function addBookmark(customerId: string, recipeSlug: string): Promise<void> {
  const recipe = await requirePublishedRecipe(recipeSlug);
  try {
    await recipeBookmarkRepository.addBookmark(recipe.id, customerId);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return; // already bookmarked — idempotent no-op, not an error
    }
    throw error;
  }
}

export async function removeBookmark(customerId: string, recipeSlug: string): Promise<void> {
  const recipe = await requirePublishedRecipe(recipeSlug);
  await recipeBookmarkRepository.removeBookmark(recipe.id, customerId);
}

/**
 * The one method STORY-037 (Saved Recipes & Sync) is expected to call/reuse
 * rather than reimplement — returns the same RecipeCard[] shape
 * RecipeGrid/RecipeCard already consume, ordered most-recently-bookmarked
 * first. findRecipesByIds (STORY-017) orders by popularity internally, so
 * the bookmark-recency order is restored here rather than in the repository.
 */
export async function listBookmarksForCustomer(customerId: string): Promise<RecipeCard[]> {
  const ids = await recipeBookmarkRepository.listBookmarkedRecipeIdsForCustomer(customerId);
  if (ids.length === 0) return [];

  const rows = await findRecipesByIds(ids, ids.length);
  const rowById = new Map(rows.map((row) => [row.id, row]));
  return ids
    .map((id) => rowById.get(id))
    .filter((row) => row !== undefined)
    .map(toRecipeCard);
}

/**
 * Merges a guest (localStorage) bookmark list into the customer's
 * server-side bookmarks on login. A small, bounded id list (capped at 200 —
 * see recipe-bookmark.schema.ts), so a single bulk findRecipesByIds
 * existence/Published check (rather than mergeGuestWishlist's per-id
 * sequential lookups) is used here since that bulk helper already exists in
 * this codebase for exactly this shape of query — see design spec decision
 * #5 for the rest of the merge flow's parity with mergeGuestWishlist.
 */
export async function mergeGuestBookmarks(customerId: string, recipeIds: string[]): Promise<void> {
  if (recipeIds.length === 0) return;

  const uniqueIds = [...new Set(recipeIds)];
  const existingIds = new Set(await recipeBookmarkRepository.findExistingBookmarkedRecipeIds(customerId, uniqueIds));
  const candidateIds = uniqueIds.filter((id) => !existingIds.has(id));
  if (candidateIds.length === 0) return;

  const publishedRows = await findRecipesByIds(candidateIds, candidateIds.length);
  const publishedIds = new Set(publishedRows.map((row) => row.id));

  for (const recipeId of candidateIds) {
    if (!publishedIds.has(recipeId)) continue;
    try {
      await recipeBookmarkRepository.addBookmark(recipeId, customerId);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
}
