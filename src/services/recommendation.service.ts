import type { CustomerGroup, RecommendationAction, RecommendationPlacement } from "@/generated/prisma/client";
import * as productRepository from "@/repositories/product.repository";
import * as recommendationRepository from "@/repositories/recommendation.repository";
import * as pricingService from "@/services/pricing.service";
import { listRelatedProducts, toProductListItem } from "@/services/product.service";
import { requirePermission } from "@/services/permission.service";
import { writeAuditLog } from "@/services/audit-log.service";
import { isFeatureEnabled } from "@/services/system-settings.service";
import type { ProductListItem } from "@/types/product";

/**
 * STORY-060. AI Product Recommendations — a swappable
 * RecommendationStrategy interface (RulesBasedStrategy,
 * CoOccurrenceStrategy), reads precomputed ProductAssociation rows at
 * request time (never computes similarity live, meeting the <300ms
 * budget the same way every cache-free part of this codebase already
 * does: a precomputed table IS the cache). Purchase/co-purchase signal
 * reads Order/OrderItem directly — no duplicated interaction row.
 */

const FEATURE_FLAG_KEY = "recommendations.behavior-based";
const COLD_START_INTERACTION_THRESHOLD = 3;
const BEST_SELLER_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function bestSellerWindowStart(): Date {
  return new Date(Date.now() - BEST_SELLER_WINDOW_DAYS * DAY_MS);
}

/** Resolves an ordered candidate id list into price-resolved, in-stock, published ProductListItems — order-preserving, since callers' ranking (association score, interaction recency) matters. */
async function resolveProductCards(ids: string[], customerGroup: CustomerGroup | undefined, excludeIds: Set<string>, limit: number): Promise<ProductListItem[]> {
  const candidateIds = ids.filter((id) => !excludeIds.has(id));
  if (candidateIds.length === 0) return [];

  const products = await productRepository.findProductsByIdsWithFilters(candidateIds, { inStock: true });
  const byId = new Map(products.map((product) => [product.id, product]));
  const resolvedPrices = await pricingService.resolvePricesForProducts(
    products.map((product) => product.id),
    { customerGroup: customerGroup ?? "Retail" },
  );

  const items: ProductListItem[] = [];
  for (const id of candidateIds) {
    const product = byId.get(id);
    if (!product) continue;
    const resolved = resolvedPrices.get(id);
    if (!resolved) continue;
    items.push(toProductListItem(product, resolved.price.toNumber(), resolved.currency));
    if (items.length >= limit) break;
  }
  return items;
}

export interface RecommendationContext {
  customerId: string | null;
  sessionId: string | null;
  customerGroup?: CustomerGroup;
  excludeProductIds?: string[];
  limit: number;
}

interface RecommendationStrategy {
  readonly name: "rules-based" | "co-occurrence";
  getHomepageRecommendations(context: RecommendationContext): Promise<ProductListItem[]>;
}

/** Cold-start fallback — best-sellers in the trailing window, same signal every anonymous/new visitor sees. */
const rulesBasedStrategy: RecommendationStrategy = {
  name: "rules-based",
  async getHomepageRecommendations(context) {
    const excludeIds = new Set(context.excludeProductIds ?? []);
    const bestSellerIds = await recommendationRepository.getBestSellingProductIds(bestSellerWindowStart(), context.limit * 2);
    return resolveProductCards(bestSellerIds, context.customerGroup, excludeIds, context.limit);
  },
};

/** Personalized — the customer's own most-interacted products, expanded via precomputed Similar associations. */
const coOccurrenceStrategy: RecommendationStrategy = {
  name: "co-occurrence",
  async getHomepageRecommendations(context) {
    const excludeIds = new Set(context.excludeProductIds ?? []);
    if (!context.customerId) return rulesBasedStrategy.getHomepageRecommendations(context);

    const seedProductIds = await recommendationRepository.getTopInteractedProductIds(context.customerId, 10);
    const expanded: string[] = [];
    const seen = new Set<string>();
    for (const seedId of seedProductIds) {
      const associations = await recommendationRepository.getAssociationsFor(seedId, "Similar", 5);
      for (const association of associations) {
        if (seen.has(association.targetProductId)) continue;
        seen.add(association.targetProductId);
        expanded.push(association.targetProductId);
      }
    }
    if (expanded.length === 0) return rulesBasedStrategy.getHomepageRecommendations(context);
    const cards = await resolveProductCards(expanded, context.customerGroup, excludeIds, context.limit);
    if (cards.length < context.limit) {
      const fallback = await rulesBasedStrategy.getHomepageRecommendations({ ...context, excludeProductIds: [...excludeIds, ...cards.map((c) => c.id)] });
      return [...cards, ...fallback].slice(0, context.limit);
    }
    return cards;
  },
};

async function getActiveStrategy(customerId: string | null): Promise<RecommendationStrategy> {
  if (!customerId) return rulesBasedStrategy;
  const [behaviorBasedEnabled, interactionCount] = await Promise.all([
    isFeatureEnabled(FEATURE_FLAG_KEY),
    recommendationRepository.countInteractionsForCustomer(customerId),
  ]);
  if (!behaviorBasedEnabled || interactionCount < COLD_START_INTERACTION_THRESHOLD) return rulesBasedStrategy;
  return coOccurrenceStrategy;
}

export interface HomepageRecommendations {
  products: ProductListItem[];
  /** Which strategy actually produced the result — drives the rail's title ("Recommended for You" vs. "Best Selling Products"). */
  personalized: boolean;
}

export async function getHomepageRecommendations(context: RecommendationContext): Promise<HomepageRecommendations> {
  const strategy = await getActiveStrategy(context.customerId);
  const products = await strategy.getHomepageRecommendations(context);
  return { products, personalized: strategy.name === "co-occurrence" && products.length > 0 };
}

/** "You May Also Like" — precomputed Similar associations when available, falling back to the existing category-match query (product.service.ts::listRelatedProducts) for a product with no association data yet. */
export async function getSimilarProducts(params: { productId: string; categoryIds: string[]; customerGroup?: CustomerGroup; limit?: number }): Promise<ProductListItem[]> {
  const limit = params.limit ?? 8;
  const associations = await recommendationRepository.getAssociationsFor(params.productId, "Similar", limit);
  if (associations.length > 0) {
    const cards = await resolveProductCards(associations.map((a) => a.targetProductId), params.customerGroup, new Set([params.productId]), limit);
    if (cards.length > 0) return cards;
  }
  return listRelatedProducts({ productId: params.productId, categoryIds: params.categoryIds, customerGroup: params.customerGroup, limit });
}

/** No rules-based fallback — absent real co-purchase data, the section is honestly omitted rather than showing fabricated pairings. */
export async function getFrequentlyBoughtTogether(params: { productId: string; customerGroup?: CustomerGroup; limit?: number }): Promise<ProductListItem[]> {
  const limit = params.limit ?? 4;
  const associations = await recommendationRepository.getAssociationsFor(params.productId, "FrequentlyBoughtTogether", limit);
  if (associations.length === 0) return [];
  return resolveProductCards(associations.map((a) => a.targetProductId), params.customerGroup, new Set([params.productId]), limit);
}

/** Cart cross-sell — Similar/FrequentlyBoughtTogether associations of everything already in the cart, excluding items already in the cart. */
export async function getCartCrossSell(params: { productIds: string[]; customerGroup?: CustomerGroup; limit?: number }): Promise<ProductListItem[]> {
  const limit = params.limit ?? 6;
  const excludeIds = new Set(params.productIds);
  const candidateIds: string[] = [];
  const seen = new Set<string>();
  for (const productId of params.productIds) {
    for (const type of ["FrequentlyBoughtTogether", "Similar"] as const) {
      const associations = await recommendationRepository.getAssociationsFor(productId, type, 5);
      for (const association of associations) {
        if (seen.has(association.targetProductId) || excludeIds.has(association.targetProductId)) continue;
        seen.add(association.targetProductId);
        candidateIds.push(association.targetProductId);
      }
    }
  }
  return resolveProductCards(candidateIds, params.customerGroup, excludeIds, limit);
}

// --- Tracking ---

export async function trackInteraction(input: { customerId: string | null; sessionId: string | null; productId: string; eventType: "View" | "AddToCart" | "WishlistAdd" }): Promise<void> {
  if (!input.customerId && !input.sessionId) return;
  await recommendationRepository.recordInteraction(input);
}

export async function trackRecommendationEvent(input: { customerId: string | null; sessionId: string | null; placement: RecommendationPlacement; productId: string; action: RecommendationAction }): Promise<void> {
  await recommendationRepository.recordRecommendationEvent(input);
}

// --- Admin-triggered recompute (no cron exists in this codebase) ---

const SIMILAR_WINDOW_DAYS = 90;
const FBT_WINDOW_DAYS = 365;
const MIN_CO_OCCURRENCE = 2;

export interface RecomputeResult {
  similarPairsWritten: number;
  frequentlyBoughtTogetherPairsWritten: number;
}

/** Full rebuild of both association types from real View/purchase history — gated Products:Edit, audit-logged, also run once from prisma/seed.ts so dev/demo/e2e environments have real data without a manual step. */
export async function recomputeProductAssociations(adminUserId: string): Promise<RecomputeResult> {
  await requirePermission(adminUserId, "Products", "Edit");

  const [coViewPairs, coPurchasePairs] = await Promise.all([
    recommendationRepository.getCoViewPairs(new Date(Date.now() - SIMILAR_WINDOW_DAYS * DAY_MS), MIN_CO_OCCURRENCE),
    recommendationRepository.getCoPurchasePairs(new Date(Date.now() - FBT_WINDOW_DAYS * DAY_MS), MIN_CO_OCCURRENCE),
  ]);

  const similarRows = pairsToDirectionalAssociations(coViewPairs);
  const fbtRows = pairsToDirectionalAssociations(coPurchasePairs);

  await recommendationRepository.replaceAssociations("Similar", similarRows);
  await recommendationRepository.replaceAssociations("FrequentlyBoughtTogether", fbtRows);

  await writeAuditLog({
    actorId: adminUserId,
    action: "recommendation_associations_recomputed",
    module: "Products",
    metadata: { similarPairsWritten: similarRows.length, frequentlyBoughtTogetherPairsWritten: fbtRows.length },
  });

  return { similarPairsWritten: similarRows.length, frequentlyBoughtTogetherPairsWritten: fbtRows.length };
}

function pairsToDirectionalAssociations(pairs: { productAId: string; productBId: string; coOccurrenceCount: number }[]): { sourceProductId: string; targetProductId: string; score: number }[] {
  const rows: { sourceProductId: string; targetProductId: string; score: number }[] = [];
  for (const pair of pairs) {
    rows.push({ sourceProductId: pair.productAId, targetProductId: pair.productBId, score: pair.coOccurrenceCount });
    rows.push({ sourceProductId: pair.productBId, targetProductId: pair.productAId, score: pair.coOccurrenceCount });
  }
  return rows;
}
