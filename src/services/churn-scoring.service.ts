import type { ChurnRiskTier } from "@/generated/prisma/client";
import * as aiInsightsRepository from "@/repositories/ai-insights.repository";
import { getCustomerMetrics } from "@/repositories/customer-segment.repository";
import { createSegment } from "@/services/crm-segmentation.service";
import { requirePermission } from "@/services/permission.service";
import { writeAuditLog } from "@/services/audit-log.service";

/**
 * STORY-064. Classical RFM churn scoring — not an LLM feature (same
 * precedent as STORY-060's recommendation logic). Reuses
 * customer-segment.repository.ts::getCustomerMetrics() directly rather
 * than recomputing Recency/Frequency/Monetary itself; only customers
 * with at least one qualifying order are scored (you can't assess churn
 * risk for someone who never purchased). No engagement signals (site
 * visits, email opens) exist anywhere in this codebase — signalBreakdown
 * records engagementSignalsAvailable: false rather than fabricating one.
 *
 * Score is 0-100, higher = more at risk, a weighted blend of three
 * documented, recalibratable risk components. Recalibrate by adjusting
 * the constants below, not the formula shape.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENCY_CAP_DAYS = 365;
const FREQUENCY_CAP_ORDERS = 10;
const MONETARY_CAP_LKR = 100_000;

const RECENCY_WEIGHT = 0.6;
const FREQUENCY_WEIGHT = 0.25;
const MONETARY_WEIGHT = 0.15;

const HIGH_RISK_MIN_SCORE = 60;
const MEDIUM_RISK_MIN_SCORE = 30;

function tierForScore(score: number): ChurnRiskTier {
  if (score >= HIGH_RISK_MIN_SCORE) return "High";
  if (score >= MEDIUM_RISK_MIN_SCORE) return "Medium";
  return "Low";
}

interface ScoreResult {
  score: number;
  riskTier: ChurnRiskTier;
  daysSinceLastOrder: number;
}

function computeScore(metrics: { orderCount: number; totalSpent: number; lastOrderAt: Date | null }): ScoreResult {
  const daysSinceLastOrder = metrics.lastOrderAt ? Math.floor((Date.now() - metrics.lastOrderAt.getTime()) / DAY_MS) : RECENCY_CAP_DAYS;

  const recencyRisk = Math.min(daysSinceLastOrder, RECENCY_CAP_DAYS) / RECENCY_CAP_DAYS;
  const frequencyRisk = 1 - Math.min(metrics.orderCount, FREQUENCY_CAP_ORDERS) / FREQUENCY_CAP_ORDERS;
  const monetaryRisk = 1 - Math.min(metrics.totalSpent, MONETARY_CAP_LKR) / MONETARY_CAP_LKR;

  const score = (recencyRisk * RECENCY_WEIGHT + frequencyRisk * FREQUENCY_WEIGHT + monetaryRisk * MONETARY_WEIGHT) * 100;
  return { score, riskTier: tierForScore(score), daysSinceLastOrder };
}

export interface RecomputeChurnScoresResult {
  customersScored: number;
  tierCounts: Record<ChurnRiskTier, number>;
}

export async function recomputeChurnScores(adminUserId: string): Promise<RecomputeChurnScoresResult> {
  await requirePermission(adminUserId, "CRMAnalytics", "Edit");

  const metricsByCustomer = await getCustomerMetrics();
  const tierCounts: Record<ChurnRiskTier, number> = { Low: 0, Medium: 0, High: 0 };

  const inputs = Array.from(metricsByCustomer.entries()).map(([customerId, metrics]) => {
    const { score, riskTier, daysSinceLastOrder } = computeScore(metrics);
    tierCounts[riskTier] += 1;
    return {
      customerId,
      score,
      riskTier,
      signalBreakdown: {
        orderCount: metrics.orderCount,
        totalSpent: metrics.totalSpent,
        daysSinceLastOrder,
        engagementSignalsAvailable: false,
      },
    };
  });

  await aiInsightsRepository.upsertChurnScores(inputs);
  await writeAuditLog({ actorId: adminUserId, action: "churn_scores_recomputed", module: "CRMAnalytics", metadata: { customersScored: inputs.length, tierCounts } });

  return { customersScored: inputs.length, tierCounts };
}

export interface ListChurnScoresFilters {
  riskTier?: ChurnRiskTier;
  page?: number;
  pageSize?: number;
}

export async function listChurnScores(adminUserId: string, filters: ListChurnScoresFilters = {}) {
  await requirePermission(adminUserId, "CRMAnalytics", "View");
  return aiInsightsRepository.listChurnScores({ riskTier: filters.riskTier, page: filters.page ?? 1, pageSize: filters.pageSize ?? 25 });
}

const TIER_LABELS: Record<ChurnRiskTier, string> = { Low: "Low", Medium: "Medium", High: "High" };

/**
 * Exports the real current members of a churn-risk tier as a SavedSegment
 * (STORY-059a) — an exact point-in-time snapshot via the new customerIds
 * filter field, not an RFM-threshold approximation. Reuses createSegment
 * directly; no new segment-resolution logic.
 */
export async function exportChurnTierToSegment(adminUserId: string, riskTier: ChurnRiskTier) {
  await requirePermission(adminUserId, "CRMAnalytics", "Edit");
  const customerIds = await aiInsightsRepository.listChurnScoreCustomerIdsForTier(riskTier);
  const name = `AI: ${TIER_LABELS[riskTier]} churn risk — ${new Date().toISOString().slice(0, 10)}`;
  return createSegment(adminUserId, { name, filterCriteria: { customerIds } });
}
