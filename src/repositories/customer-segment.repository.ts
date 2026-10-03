import type { CustomerGroup, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * STORY-059a. The first customer-spend aggregation in this codebase —
 * user.repository.ts::listCustomersForAdmin (STORY-048) never joined
 * Order data. CLV excludes Cancelled orders, matching
 * order.repository.ts::getOrderSummaryForRange's (STORY-039) exact
 * inclusion rule, so this figure and the dashboard's revenue stay
 * consistent with each other.
 */

export interface CustomerMetrics {
  orderCount: number;
  totalSpent: number;
  lastOrderAt: Date | null;
}

/** One groupBy for every customer's {orderCount, totalSpent, lastOrderAt} — Prisma can't filter `where` on a relation's SUM/COUNT directly, so callers intersect this map with listCandidateUsers()'s plain `where` results in memory. */
export async function getCustomerMetrics(): Promise<Map<string, CustomerMetrics>> {
  const rows = await prisma.order.groupBy({
    by: ["userId"],
    where: { status: { not: "Cancelled" }, userId: { not: null } },
    _sum: { grandTotal: true },
    _count: { _all: true },
    _max: { createdAt: true },
  });

  const metrics = new Map<string, CustomerMetrics>();
  for (const row of rows) {
    if (!row.userId) continue;
    metrics.set(row.userId, {
      orderCount: row._count._all,
      totalSpent: Number(row._sum.grandTotal ?? 0),
      lastOrderAt: row._max.createdAt,
    });
  }
  return metrics;
}

export async function getCustomerMetricsFor(userId: string): Promise<CustomerMetrics> {
  const result = await prisma.order.aggregate({
    where: { userId, status: { not: "Cancelled" } },
    _sum: { grandTotal: true },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  return { orderCount: result._count._all, totalSpent: Number(result._sum.grandTotal ?? 0), lastOrderAt: result._max.createdAt };
}

export interface CandidateUserFilters {
  rewardTierId?: string;
  city?: string;
  customerGroup?: CustomerGroup;
}

export interface CandidateUser {
  id: string;
  name: string | null;
  email: string | null;
  customerGroup: CustomerGroup;
  rewardAccount: { currentTier: { id: string; name: string } | null } | null;
  addresses: { city: string; isDefaultShipping: boolean }[];
}

/** The non-aggregate half of a segment's filter — reward tier, customer group, and location (read via the default shipping address, since User has no single "location" field). */
export function listCandidateUsers(filters: CandidateUserFilters): Promise<CandidateUser[]> {
  const where: Prisma.UserWhereInput = {
    ...(filters.customerGroup ? { customerGroup: filters.customerGroup } : {}),
    ...(filters.rewardTierId ? { rewardAccount: { currentTierId: filters.rewardTierId } } : {}),
    ...(filters.city ? { addresses: { some: { city: { equals: filters.city, mode: "insensitive" } } } } : {}),
  };
  return prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      customerGroup: true,
      rewardAccount: { select: { currentTier: { select: { id: true, name: true } } } },
      addresses: { select: { city: true, isDefaultShipping: true } },
    },
  });
}
