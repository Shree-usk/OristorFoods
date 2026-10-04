/** STORY-064. Admin fetch wrappers for /api/admin/ai-insights/*. */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type ChurnRiskTierValue = "Low" | "Medium" | "High";

export interface InsightSnapshot {
  narrativeText: string;
  generatedAt: string;
  sourceQueryRef: unknown;
}

export interface CampaignSuggestionPayload {
  title: string;
  rationale: string;
  suggestedProductIds: string[];
  targetChurnTier: ChurnRiskTierValue | null;
}

export interface CampaignSuggestion {
  id: string;
  narrativeText: string;
  structuredPayload: CampaignSuggestionPayload | null;
  generatedAt: string;
}

export interface InsightsSummary {
  trend: InsightSnapshot | null;
  anomaly: InsightSnapshot | null;
  campaignSuggestions: CampaignSuggestion[];
}

export async function fetchInsightsSummary(): Promise<InsightsSummary> {
  const response = await fetch("/api/admin/ai-insights/summary");
  if (!response.ok) throw new Error("Failed to load AI insights");
  return response.json();
}

export interface RecomputeInsightsResult {
  generated: boolean;
  trendCount: number;
  anomalyCount: number;
  suggestionCount: number;
}

export async function recomputeInsightsAdmin(): Promise<RecomputeInsightsResult> {
  const response = await fetch("/api/admin/ai-insights/recompute-insights", { method: "POST" });
  await assertOkWithServerMessage(response, "Failed to recompute insights");
  return response.json();
}

export interface ChurnScoreRow {
  id: string;
  customerId: string;
  score: number;
  riskTier: ChurnRiskTierValue;
  signalBreakdown: { orderCount: number; totalSpent: number; daysSinceLastOrder: number; engagementSignalsAvailable: false };
  computedAt: string;
  customer: { id: string; name: string | null; email: string | null };
}

export interface ChurnScoreList {
  rows: ChurnScoreRow[];
  total: number;
  tierCounts: Record<ChurnRiskTierValue, number>;
}

export async function fetchChurnScores(filters: { riskTier?: ChurnRiskTierValue; page?: number; pageSize?: number } = {}): Promise<ChurnScoreList> {
  const params = new URLSearchParams();
  if (filters.riskTier) params.set("riskTier", filters.riskTier);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  const response = await fetch(`/api/admin/ai-insights/churn-risk?${params.toString()}`);
  if (!response.ok) throw new Error("Failed to load churn-risk scores");
  return response.json();
}

export interface RecomputeChurnResult {
  customersScored: number;
  tierCounts: Record<ChurnRiskTierValue, number>;
}

export async function recomputeChurnScoresAdmin(): Promise<RecomputeChurnResult> {
  const response = await fetch("/api/admin/ai-insights/recompute-churn", { method: "POST" });
  await assertOkWithServerMessage(response, "Failed to recompute churn scores");
  return response.json();
}

export async function exportChurnTierToSegmentAdmin(riskTier: ChurnRiskTierValue): Promise<{ id: string; name: string }> {
  const response = await fetch("/api/admin/ai-insights/export-churn-segment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ riskTier }),
  });
  await assertOkWithServerMessage(response, "Failed to export the segment");
  return response.json();
}
