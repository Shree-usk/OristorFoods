import type { BusinessInsightMetricType, ChurnRiskTier, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-064. The only place CustomerChurnScore/BusinessInsightSnapshot are queried/mutated. */

export interface ChurnScoreUpsertInput {
  customerId: string;
  score: number;
  riskTier: ChurnRiskTier;
  signalBreakdown: Prisma.InputJsonValue;
}

export async function upsertChurnScores(inputs: ChurnScoreUpsertInput[]) {
  await prisma.$transaction(
    inputs.map((input) =>
      prisma.customerChurnScore.upsert({
        where: { customerId: input.customerId },
        create: { ...input, computedAt: new Date() },
        update: { score: input.score, riskTier: input.riskTier, signalBreakdown: input.signalBreakdown, computedAt: new Date() },
      }),
    ),
  );
}

export interface ListChurnScoresFilters {
  riskTier?: ChurnRiskTier;
  page: number;
  pageSize: number;
}

export async function listChurnScores(filters: ListChurnScoresFilters) {
  const where: Prisma.CustomerChurnScoreWhereInput = filters.riskTier ? { riskTier: filters.riskTier } : {};
  const [rows, total, tierGroups] = await Promise.all([
    prisma.customerChurnScore.findMany({
      where,
      include: { customer: { select: { id: true, name: true, email: true } } },
      orderBy: { score: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.customerChurnScore.count({ where }),
    // Unfiltered tier distribution, for the chart — independent of the riskTier filter/pagination above.
    prisma.customerChurnScore.groupBy({ by: ["riskTier"], _count: { _all: true } }),
  ]);
  const tierCounts: Record<ChurnRiskTier, number> = { Low: 0, Medium: 0, High: 0 };
  for (const group of tierGroups) tierCounts[group.riskTier] = group._count._all;
  return { rows, total, tierCounts };
}

export function listChurnScoreCustomerIdsForTier(riskTier: ChurnRiskTier) {
  return prisma.customerChurnScore.findMany({ where: { riskTier }, select: { customerId: true } }).then((rows) => rows.map((row) => row.customerId));
}

export interface CreateSnapshotInput {
  periodStart: Date;
  periodEnd: Date;
  metricType: BusinessInsightMetricType;
  narrativeText: string;
  sourceQueryRef: Prisma.InputJsonValue;
  structuredPayload?: Prisma.InputJsonValue;
  /** 0 for Trend/Anomaly (one row per period); 0..N-1 for CampaignSuggestion (one row per idea in the batch). */
  sequence?: number;
}

export function createSnapshots(inputs: CreateSnapshotInput[]) {
  return prisma.businessInsightSnapshot.createMany({ data: inputs });
}

export function findLatestSnapshotByType(metricType: BusinessInsightMetricType) {
  return prisma.businessInsightSnapshot.findFirst({ where: { metricType }, orderBy: { generatedAt: "desc" } });
}

/** All CampaignSuggestion rows from the single most recent recompute batch (same periodStart/periodEnd), not just the latest N rows overall. */
export async function findLatestCampaignSuggestions() {
  const latest = await prisma.businessInsightSnapshot.findFirst({ where: { metricType: "CampaignSuggestion" }, orderBy: { generatedAt: "desc" } });
  if (!latest) return [];
  return prisma.businessInsightSnapshot.findMany({
    where: { metricType: "CampaignSuggestion", periodStart: latest.periodStart, periodEnd: latest.periodEnd },
    orderBy: { sequence: "asc" },
  });
}
