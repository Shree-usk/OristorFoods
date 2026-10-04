import type { ProductAssociationType, RecommendationAction, RecommendationPlacement } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * STORY-060. The only file querying ProductInteractionEvent/
 * ProductAssociation/RecommendationEvent directly. Purchase signal
 * (best-sellers, co-purchase pairs) is read from Order/OrderItem
 * directly — deliberately no duplicate Purchase row in
 * ProductInteractionEvent, which only tracks View/AddToCart/
 * WishlistAdd (nothing else persists those server-side today).
 */

export interface RecordInteractionInput {
  customerId: string | null;
  sessionId: string | null;
  productId: string;
  eventType: "View" | "AddToCart" | "WishlistAdd";
}

export function recordInteraction(input: RecordInteractionInput) {
  return prisma.productInteractionEvent.create({ data: input });
}

export interface RecordRecommendationEventInput {
  customerId: string | null;
  sessionId: string | null;
  placement: RecommendationPlacement;
  productId: string;
  action: RecommendationAction;
}

export function recordRecommendationEvent(input: RecordRecommendationEventInput) {
  return prisma.recommendationEvent.create({ data: input });
}

export function countInteractionsForCustomer(customerId: string) {
  return prisma.productInteractionEvent.count({ where: { customerId } });
}

export async function getTopInteractedProductIds(customerId: string, limit: number): Promise<string[]> {
  const grouped = await prisma.productInteractionEvent.groupBy({
    by: ["productId"],
    where: { customerId },
    _count: { _all: true },
    orderBy: { _count: { productId: "desc" } },
    take: limit,
  });
  return grouped.map((row) => row.productId);
}

export interface AssociationRow {
  targetProductId: string;
  score: number;
}

export async function getAssociationsFor(productId: string, type: ProductAssociationType, limit: number): Promise<AssociationRow[]> {
  const rows = await prisma.productAssociation.findMany({
    where: { sourceProductId: productId, associationType: type },
    orderBy: { score: "desc" },
    take: limit,
    select: { targetProductId: true, score: true },
  });
  return rows;
}

/** Best-sellers by quantity sold in [from, now) — the cold-start fallback signal, read directly from OrderItem (no new table). */
export async function getBestSellingProductIds(from: Date, limit: number): Promise<string[]> {
  const grouped = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { order: { createdAt: { gte: from }, status: { not: "Cancelled" } } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });
  return grouped.filter((row) => row.productId !== null).map((row) => row.productId!);
}

/** Replaces every precomputed association of the given type in one transaction — recompute is always a full rebuild, never an incremental patch. */
export async function replaceAssociations(type: ProductAssociationType, rows: { sourceProductId: string; targetProductId: string; score: number }[]) {
  await prisma.$transaction([
    prisma.productAssociation.deleteMany({ where: { associationType: type } }),
    ...(rows.length > 0 ? [prisma.productAssociation.createMany({ data: rows.map((row) => ({ ...row, associationType: type })) })] : []),
  ]);
}

export interface CoPurchasePair {
  productAId: string;
  productBId: string;
  coOccurrenceCount: number;
}

/**
 * Unordered co-purchase pairs (oi1.productId < oi2.productId avoids
 * double-counting and self-pairs) — the FrequentlyBoughtTogether
 * signal. Raw SQL: a pairwise self-join groupBy has no Prisma
 * query-builder equivalent, the same precedent
 * analytics.repository.ts::getSalesTrend already established for
 * anything it can't express.
 */
export async function getCoPurchasePairs(from: Date, minCoOccurrence: number): Promise<CoPurchasePair[]> {
  return prisma.$queryRaw<CoPurchasePair[]>`
    SELECT oi1."productId" AS "productAId", oi2."productId" AS "productBId", COUNT(DISTINCT oi1."orderId")::int AS "coOccurrenceCount"
    FROM "OrderItem" oi1
    JOIN "OrderItem" oi2 ON oi1."orderId" = oi2."orderId" AND oi1."productId" < oi2."productId"
    JOIN "Order" o ON o.id = oi1."orderId"
    WHERE o."createdAt" >= ${from} AND o.status != ${"Cancelled"}::"OrderStatus"
    GROUP BY oi1."productId", oi2."productId"
    HAVING COUNT(DISTINCT oi1."orderId") >= ${minCoOccurrence}
    ORDER BY "coOccurrenceCount" DESC
  `;
}

export interface CoViewPair {
  productAId: string;
  productBId: string;
  coOccurrenceCount: number;
}

/** Same shape as getCoPurchasePairs, over View events by the same logged-in customer — the Similar signal. Anonymous sessionId co-views are deliberately out of scope (a cleared/shared cookie is a much less reliable identity than a customerId). */
export async function getCoViewPairs(from: Date, minCoOccurrence: number): Promise<CoViewPair[]> {
  return prisma.$queryRaw<CoViewPair[]>`
    SELECT e1."productId" AS "productAId", e2."productId" AS "productBId", COUNT(DISTINCT e1."customerId")::int AS "coOccurrenceCount"
    FROM "ProductInteractionEvent" e1
    JOIN "ProductInteractionEvent" e2 ON e1."customerId" = e2."customerId" AND e1."productId" < e2."productId"
    WHERE e1."customerId" IS NOT NULL AND e1."eventType" = 'View'::"ProductInteractionEventType" AND e2."eventType" = 'View'::"ProductInteractionEventType" AND e1."createdAt" >= ${from}
    GROUP BY e1."productId", e2."productId"
    HAVING COUNT(DISTINCT e1."customerId") >= ${minCoOccurrence}
    ORDER BY "coOccurrenceCount" DESC
  `;
}
