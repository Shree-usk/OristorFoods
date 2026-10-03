import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import * as recipeRepository from "@/repositories/recipe.repository";
import { hasPermission } from "@/services/permission.service";

/**
 * STORY-053 (additive scope). A thin, read-side aggregation across
 * content types' own independent lifecycles — mirrors
 * admin-reviews-queue-view.tsx's established pattern (a per-sourceType
 * lookup, not one shared state machine) rather than retrofitting
 * Homepage/Recipe/Blog onto a generic workflow engine. Only Recipe has
 * a review step today; adding Homepage/Blog later, if they ever grow
 * one, is a one-entry addition to QUEUE_SOURCES below, not a
 * rearchitecture.
 *
 * "My queue" = every registered source the caller actually holds the
 * gating permission for — this RBAC model has no per-item assignment,
 * so personalization is by role, same as every other admin list in
 * this codebase.
 */

const BULK_LIST_SIZE = 10_000;

export interface ReviewQueueItem {
  sourceType: string;
  id: string;
  title: string;
  status: string;
  updatedAt: Date;
  href: string;
}

interface QueueSource {
  sourceType: string;
  module: AdminModule;
  action: AdminAction;
  fetchPending: () => Promise<ReviewQueueItem[]>;
}

const QUEUE_SOURCES: QueueSource[] = [
  {
    sourceType: "Recipe",
    module: "Recipes",
    action: "Approve",
    fetchPending: async () => {
      const { items } = await recipeRepository.listRecipesForAdmin({ status: "Review" }, 1, BULK_LIST_SIZE);
      return items.map((item) => ({ sourceType: "Recipe", id: item.id, title: item.title, status: item.status, updatedAt: item.updatedAt, href: `/admin/recipes/${item.id}` }));
    },
  },
];

export async function getMyReviewQueue(adminUserId: string): Promise<ReviewQueueItem[]> {
  const eligibleSources = await Promise.all(
    QUEUE_SOURCES.map(async (source) => ((await hasPermission(adminUserId, source.module, source.action)) ? source : null)),
  );

  const items = await Promise.all(eligibleSources.filter((source): source is QueueSource => source !== null).map((source) => source.fetchPending()));
  return items.flat().sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
}
