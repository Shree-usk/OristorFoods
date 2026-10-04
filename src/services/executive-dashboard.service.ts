import { getOrderSummaryForRange } from "@/repositories/order.repository";
import { getCustomerRetention } from "@/repositories/analytics.repository";
import { getExportEnquiryVolumeForRange, getLoyaltyEngagementForRange } from "@/repositories/executive-dashboard.repository";
import { requirePermission } from "@/services/permission.service";

/**
 * STORY-059c. Executive Dashboard — a distinct, strategic/trend-level
 * view from STORY-039's operational admin-dashboard.service.ts, gated
 * CRMAnalytics:View (same module 059a/b already made real). Pure
 * reads, no audit logging, matching 059a/b's own convention for
 * read-only report endpoints.
 */

export interface KpiComparison {
  current: number;
  previous: number;
  /**
   * Relative % change vs. the prior period. `null` when the prior
   * period's value was zero and the current period's is not — "grew
   * from zero" has no meaningful percentage, so this is left honestly
   * unavailable rather than reported as a fabricated number.
   */
  changePercent: number | null;
}

function compare(current: number, previous: number): KpiComparison {
  const changePercent = previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / previous) * 100;
  return { current, previous, changePercent };
}

/** [from, to] and the immediately preceding period of equal length. */
function priorPeriod(from: Date, to: Date): { priorFrom: Date; priorTo: Date } {
  const durationMs = to.getTime() - from.getTime();
  const priorTo = new Date(from.getTime() - 1);
  const priorFrom = new Date(priorTo.getTime() - durationMs);
  return { priorFrom, priorTo };
}

export interface ExecutiveSummary {
  revenue: KpiComparison;
  returningCustomerRate: KpiComparison;
  averageOrderValue: KpiComparison;
  /** Reward redemptions + referral signups in the period, combined into one engagement count. */
  loyaltyEngagement: KpiComparison;
  exportEnquiryVolume: KpiComparison;
  /** No visit/performance tracking exists anywhere in this codebase — same honest gap as 059b's funnel Visits/Checkout and STORY-057's System Health uptime. */
  coreWebVitals: { available: false };
}

function averageOrderValue(orderCount: number, grandTotal: string): number {
  return orderCount > 0 ? Number(grandTotal) / orderCount : 0;
}

export async function getExecutiveSummary(adminUserId: string, from: Date, to: Date): Promise<ExecutiveSummary> {
  await requirePermission(adminUserId, "CRMAnalytics", "View");
  const { priorFrom, priorTo } = priorPeriod(from, to);

  const [revenueCurrent, revenuePrior, retentionCurrent, retentionPrior, loyaltyCurrent, loyaltyPrior, exportCurrent, exportPrior] = await Promise.all([
    getOrderSummaryForRange(from, to),
    getOrderSummaryForRange(priorFrom, priorTo),
    getCustomerRetention(from, to),
    getCustomerRetention(priorFrom, priorTo),
    getLoyaltyEngagementForRange(from, to),
    getLoyaltyEngagementForRange(priorFrom, priorTo),
    getExportEnquiryVolumeForRange(from, to),
    getExportEnquiryVolumeForRange(priorFrom, priorTo),
  ]);

  return {
    revenue: compare(Number(revenueCurrent.grandTotal), Number(revenuePrior.grandTotal)),
    returningCustomerRate: compare(retentionCurrent.retentionRate, retentionPrior.retentionRate),
    averageOrderValue: compare(averageOrderValue(revenueCurrent.orderCount, revenueCurrent.grandTotal), averageOrderValue(revenuePrior.orderCount, revenuePrior.grandTotal)),
    loyaltyEngagement: compare(loyaltyCurrent.redemptions + loyaltyCurrent.referralSignups, loyaltyPrior.redemptions + loyaltyPrior.referralSignups),
    exportEnquiryVolume: compare(exportCurrent, exportPrior),
    coreWebVitals: { available: false },
  };
}
