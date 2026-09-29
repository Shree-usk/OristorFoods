import { getBalanceForUser, type RewardsBalance } from "@/services/rewards.service";
import { listOrdersForUser } from "@/services/order.service";
import { listBookmarksForCustomer } from "@/services/recipe-bookmark.service";
import { getWishlist } from "@/services/wishlist.service";
import type { OrderListSummary } from "@/types/order";
import type { ProductListItem } from "@/types/product";

/**
 * STORY-033. Aggregation only, for the dashboard's summary widgets — no
 * order/reward/wishlist business logic lives here (that's owned by
 * order.service.ts, rewards.service.ts, and wishlist.service.ts
 * respectively). Deliberately three separate functions rather than one
 * that awaits all three: the dashboard page renders each widget in its
 * own <Suspense> boundary, so a slow call here must only block its own
 * widget, never the others (see the story's AC).
 */

const RECENT_ORDERS_LIMIT = 3;
const SAVED_ITEMS_PREVIEW_LIMIT = 4;

export async function getRecentOrdersForDashboard(userId: string): Promise<OrderListSummary[]> {
  const { orders } = await listOrdersForUser(userId, 1, RECENT_ORDERS_LIMIT);
  return orders;
}

export function getRewardsSummaryForDashboard(userId: string): Promise<RewardsBalance> {
  return getBalanceForUser(userId);
}

export interface SavedItemsSummary {
  count: number;
  preview: ProductListItem[];
}

export async function getSavedItemsForDashboard(userId: string): Promise<SavedItemsSummary> {
  const items = await getWishlist(userId);
  return { count: items.length, preview: items.slice(0, SAVED_ITEMS_PREVIEW_LIMIT) };
}

/** STORY-037. Same source listBookmarksForCustomer as /account/saved-recipes itself, so this count can never drift from the page's own count. */
export async function getSavedRecipesCountForDashboard(userId: string): Promise<number> {
  const recipes = await listBookmarksForCustomer(userId);
  return recipes.length;
}
