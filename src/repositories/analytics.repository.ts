import { prisma } from "@/lib/db";

/**
 * STORY-059b. Analytics/BI reports — read-mostly aggregation over
 * Order/OrderItem/Product/Recipe/User, owned by other stories. The
 * day/week/month time-series reads use prisma.$queryRaw (DATE_TRUNC),
 * the one thing Prisma's query builder can't express — the same
 * precedent search.repository.ts::findRankedProductMatches (STORY-012)
 * already established for this codebase. Every raw value is
 * interpolated through the tagged template (parameterized), never
 * string-concatenated.
 */

export type TrendBucket = "day" | "week" | "month";

export interface SalesTrendPoint {
  bucket: Date;
  revenue: number;
  orderCount: number;
}

export async function getSalesTrend(from: Date, to: Date, bucket: TrendBucket): Promise<SalesTrendPoint[]> {
  const rows = await prisma.$queryRaw<{ bucket: Date; revenue: string | null; orderCount: number }[]>`
    SELECT
      DATE_TRUNC(${bucket}, "createdAt") AS bucket,
      COALESCE(SUM("grandTotal"), 0)::text AS revenue,
      COUNT(*)::int AS "orderCount"
    FROM "Order"
    WHERE "createdAt" >= ${from} AND "createdAt" <= ${to} AND status != ${"Cancelled"}::"OrderStatus"
    GROUP BY bucket
    ORDER BY bucket ASC
  `;
  return rows.map((row) => ({ bucket: row.bucket, revenue: Number(row.revenue ?? 0), orderCount: row.orderCount }));
}

export interface SalesByCategoryRow {
  categoryName: string;
  revenue: number;
  quantity: number;
}

/** Product.categories is many-to-many — aggregated in memory after a single Prisma read, same pattern 059a's filterCustomers() uses, rather than a raw join. */
export async function getSalesByCategory(from: Date, to: Date): Promise<SalesByCategoryRow[]> {
  const items = await prisma.orderItem.findMany({
    where: { order: { createdAt: { gte: from, lte: to }, status: { not: "Cancelled" } } },
    select: { quantity: true, lineTotal: true, product: { select: { categories: { select: { name: true } } } } },
  });

  const byCategory = new Map<string, SalesByCategoryRow>();
  for (const item of items) {
    const categories = item.product?.categories ?? [];
    const names = categories.length > 0 ? categories.map((c) => c.name) : ["Uncategorized"];
    for (const name of names) {
      const existing = byCategory.get(name) ?? { categoryName: name, revenue: 0, quantity: 0 };
      existing.revenue += Number(item.lineTotal);
      existing.quantity += item.quantity;
      byCategory.set(name, existing);
    }
  }
  return [...byCategory.values()].sort((a, b) => b.revenue - a.revenue);
}

export interface SalesByRegionRow {
  region: string;
  revenue: number;
  orderCount: number;
}

export async function getSalesByRegion(from: Date, to: Date): Promise<SalesByRegionRow[]> {
  const rows = await prisma.order.groupBy({
    by: ["deliveryZoneName"],
    where: { createdAt: { gte: from, lte: to }, status: { not: "Cancelled" } },
    _sum: { grandTotal: true },
    _count: { _all: true },
  });
  return rows
    .map((row) => ({ region: row.deliveryZoneName ?? "Unknown", revenue: Number(row._sum.grandTotal ?? 0), orderCount: row._count._all }))
    .sort((a, b) => b.revenue - a.revenue);
}

export interface TopProductRow {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
}

export async function getTopProducts(from: Date, to: Date, limit: number): Promise<TopProductRow[]> {
  const grouped = await prisma.orderItem.groupBy({
    by: ["productId", "productName"],
    where: { order: { createdAt: { gte: from, lte: to }, status: { not: "Cancelled" } } },
    _sum: { quantity: true, lineTotal: true },
    orderBy: { _sum: { lineTotal: "desc" } },
    take: limit,
  });
  return grouped
    .filter((row) => row.productId !== null)
    .map((row) => ({ productId: row.productId!, productName: row.productName, quantity: row._sum.quantity ?? 0, revenue: Number(row._sum.lineTotal ?? 0) }));
}

export interface TopRecipeRow {
  recipeId: string;
  title: string;
  viewCount: number;
  avgRating: number | null;
  ratingCount: number;
}

/** Recipe.viewCount/avgRating/ratingCount are already denormalized and indexed (@@index([status, viewCount])) — a sorted read, no new aggregation needed. */
export async function getTopRecipes(limit: number): Promise<TopRecipeRow[]> {
  const recipes = await prisma.recipe.findMany({
    where: { status: "Published" },
    select: { id: true, title: true, viewCount: true, avgRating: true, ratingCount: true },
    orderBy: { viewCount: "desc" },
    take: limit,
  });
  return recipes.map((r) => ({ recipeId: r.id, title: r.title, viewCount: r.viewCount, avgRating: r.avgRating ? Number(r.avgRating) : null, ratingCount: r.ratingCount }));
}

export interface AcquisitionPoint {
  bucket: Date;
  newCustomers: number;
}

export async function getCustomerAcquisition(from: Date, to: Date, bucket: TrendBucket): Promise<AcquisitionPoint[]> {
  const rows = await prisma.$queryRaw<{ bucket: Date; newCustomers: number }[]>`
    SELECT
      DATE_TRUNC(${bucket}, "createdAt") AS bucket,
      COUNT(*)::int AS "newCustomers"
    FROM "User"
    WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
    GROUP BY bucket
    ORDER BY bucket ASC
  `;
  return rows;
}

export interface RetentionSummary {
  activeCustomers: number;
  repeatCustomers: number;
  retentionRate: number;
}

/**
 * Of customers who placed at least one non-Cancelled order in [from,to]
 * ("activeCustomers"), what fraction have 2+ non-Cancelled orders
 * all-time ("repeatCustomers")? A repeat-purchase rate anchored to the
 * period's active customers — stated explicitly in the UI so the
 * number is never ambiguous. Deliberately local to this file, not an
 * extension of customer-segment.repository.ts::getCustomerMetrics()
 * (059a), which has no date parameter and is already shipped.
 */
export async function getCustomerRetention(from: Date, to: Date): Promise<RetentionSummary> {
  const activeInPeriod = await prisma.order.findMany({
    where: { createdAt: { gte: from, lte: to }, status: { not: "Cancelled" }, userId: { not: null } },
    select: { userId: true },
    distinct: ["userId"],
  });
  const activeUserIds = activeInPeriod.map((o) => o.userId!);
  if (activeUserIds.length === 0) return { activeCustomers: 0, repeatCustomers: 0, retentionRate: 0 };

  const lifetimeCounts = await prisma.order.groupBy({
    by: ["userId"],
    where: { userId: { in: activeUserIds }, status: { not: "Cancelled" } },
    _count: { _all: true },
  });
  const repeatCustomers = lifetimeCounts.filter((row) => row._count._all >= 2).length;

  return { activeCustomers: activeUserIds.length, repeatCustomers, retentionRate: repeatCustomers / activeUserIds.length };
}

export interface ConversionFunnel {
  cartsWithItems: number;
  confirmedOrders: number;
}

/**
 * Only two real numbers — no "Visits"/"Checkout" data exists anywhere
 * in this codebase (same gap documented for Live Visitors/Core Web
 * Vitals). cartsWithItems is a best-effort current-state read — Cart
 * is a mutable singleton per user/guest, not an event log, so a cart
 * touched again today still counts as "today" even if first created
 * much earlier; the UI states this explicitly.
 */
export async function getConversionFunnel(from: Date, to: Date): Promise<ConversionFunnel> {
  const [cartsWithItems, confirmedOrders] = await Promise.all([
    prisma.cart.count({ where: { updatedAt: { gte: from, lte: to }, items: { some: {} } } }),
    prisma.order.count({ where: { createdAt: { gte: from, lte: to }, status: { not: "Cancelled" } } }),
  ]);
  return { cartsWithItems, confirmedOrders };
}
