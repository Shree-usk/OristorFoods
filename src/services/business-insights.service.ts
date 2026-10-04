import type { ChurnRiskTier } from "@/generated/prisma/client";
import * as aiInsightsRepository from "@/repositories/ai-insights.repository";
import { getProductRevenueForIds, getSalesTrend, getTopProducts } from "@/repositories/analytics.repository";
import { OpenAiChatProvider } from "@/services/chat/openai-chat.provider";
import type { ChatCompletionMessage, ChatCompletionProvider } from "@/services/chat/chat-completion-provider.interface";
import { requirePermission } from "@/services/permission.service";
import { writeAuditLog } from "@/services/audit-log.service";

/**
 * STORY-064. Trend/anomaly narrative summaries + human-reviewable
 * campaign suggestions. Real data is computed deterministically first
 * (trend/anomaly detection below); the LLM is given only that real data
 * and asked for a plain-language narrative plus structured suggestions —
 * the same retrieve → ground → generate → validate shape as 062/063, no
 * raw token streaming (see docs/architecture-decisions.md). Lower
 * security stakes than 063 (internal admin-only aggregate data, no
 * cross-customer PII vector) — this is about claim accuracy (AC #6: no
 * unverifiable black-box claims), not data isolation.
 *
 * Campaign suggestions reference real product ids (guardrail-filtered
 * to the real candidate set) and, when customer-targeted, a real churn
 * tier (Low/Medium/High — a closed enum, not an LLM-invented filter
 * shape) rather than a freeform SegmentFilterCriteria object the model
 * could fabricate. "Send to Marketing" uses exportChurnTierToSegment
 * for the real segment when a tier is set.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_PRODUCT_LIMIT = 10;
const TREND_NARRATIVE_LIMIT = 5;
const ANOMALY_TRAILING_WINDOW_DAYS = 7;
const ANOMALY_DROP_THRESHOLD = 0.4; // flag a day more than 40% below its trailing average

let chatProvider: ChatCompletionProvider = new OpenAiChatProvider();

/** Test-only seam — mirrors recipe-assistant.service.ts/support-assistant.service.ts's own pattern. */
export function setBusinessInsightsProvidersForTesting(providers: { chat?: ChatCompletionProvider }) {
  if (providers.chat) chatProvider = providers.chat;
}

function priorPeriod(from: Date, to: Date): { priorFrom: Date; priorTo: Date } {
  const durationMs = to.getTime() - from.getTime();
  const priorTo = new Date(from.getTime() - 1);
  const priorFrom = new Date(priorTo.getTime() - durationMs);
  return { priorFrom, priorTo };
}

interface TrendPoint {
  productId: string;
  productName: string;
  currentRevenue: number;
  priorRevenue: number;
  growthPercent: number | null;
  isNew: boolean;
}

async function computeTrends(from: Date, to: Date): Promise<TrendPoint[]> {
  const { priorFrom, priorTo } = priorPeriod(from, to);
  const currentTop = await getTopProducts(from, to, TREND_PRODUCT_LIMIT);
  const priorRevenueById = await getProductRevenueForIds(
    currentTop.map((p) => p.productId),
    priorFrom,
    priorTo,
  );

  const points: TrendPoint[] = currentTop.map((product) => {
    const prior = priorRevenueById.get(product.productId);
    const priorRevenue = prior?.revenue ?? 0;
    const isNew = priorRevenue === 0 && product.revenue > 0;
    const growthPercent = priorRevenue === 0 ? null : ((product.revenue - priorRevenue) / priorRevenue) * 100;
    return { productId: product.productId, productName: product.productName, currentRevenue: product.revenue, priorRevenue, growthPercent, isNew };
  });

  return points.sort((a, b) => (b.growthPercent ?? Number.POSITIVE_INFINITY) - (a.growthPercent ?? Number.POSITIVE_INFINITY)).slice(0, TREND_NARRATIVE_LIMIT);
}

interface AnomalyPoint {
  date: string;
  orderCount: number;
  trailingAverage: number;
  percentBelowAverage: number;
}

/**
 * Order-count anomalies only — no traffic/conversion data exists anywhere
 * in this codebase (same gap STORY-059b's funnel Visits/Checkout already
 * documents as `available: false`). The narrative text itself, not just
 * this comment, states that limitation (see buildPrompt below), so an
 * Executive reading the panel isn't misled into assuming traffic was
 * checked when it wasn't.
 */
async function computeAnomalies(from: Date, to: Date): Promise<AnomalyPoint[]> {
  const windowStart = new Date(from.getTime() - ANOMALY_TRAILING_WINDOW_DAYS * DAY_MS);
  const buckets = await getSalesTrend(windowStart, to, "day");

  const anomalies: AnomalyPoint[] = [];
  for (let i = ANOMALY_TRAILING_WINDOW_DAYS; i < buckets.length; i++) {
    const day = buckets[i];
    if (day.bucket < from) continue;
    const trailing = buckets.slice(i - ANOMALY_TRAILING_WINDOW_DAYS, i);
    const trailingAverage = trailing.reduce((sum, b) => sum + b.orderCount, 0) / trailing.length;
    if (trailingAverage === 0) continue;
    const percentBelowAverage = ((trailingAverage - day.orderCount) / trailingAverage) * 100;
    if (percentBelowAverage >= ANOMALY_DROP_THRESHOLD * 100) {
      anomalies.push({ date: day.bucket.toISOString().slice(0, 10), orderCount: day.orderCount, trailingAverage: Math.round(trailingAverage * 10) / 10, percentBelowAverage: Math.round(percentBelowAverage) });
    }
  }
  return anomalies;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    trendNarrative: { type: "string" },
    anomalyNarrative: { type: "string" },
    campaignSuggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          rationale: { type: "string" },
          productIds: { type: "array", items: { type: "string" } },
          targetChurnTier: { type: ["string", "null"], enum: ["Low", "Medium", "High", null] },
        },
        required: ["title", "rationale", "productIds", "targetChurnTier"],
        additionalProperties: false,
      },
    },
  },
  required: ["trendNarrative", "anomalyNarrative", "campaignSuggestions"],
  additionalProperties: false,
} as const;

interface StructuredSuggestion {
  title: string;
  rationale: string;
  productIds: string[];
  targetChurnTier: ChurnRiskTier | null;
}

interface StructuredResponse {
  trendNarrative: string;
  anomalyNarrative: string;
  campaignSuggestions: StructuredSuggestion[];
}

const SYSTEM_PROMPT = `You are an analyst writing a short, plain-language business insights summary for Oristor Food Products' Executive Dashboard, from real computed data given to you below. Oristor is a premium Sri Lankan food brand.
You must ONLY reference products and numbers from the data given to you — never invent a product, figure, or date.
IMPORTANT: this system tracks order volume only — it has no site traffic or conversion-funnel data. Your anomalyNarrative must explicitly state that only order volume was checked, and must never claim or imply that traffic or conversion was analyzed.
Suggest up to 3 human-reviewable campaign ideas in campaignSuggestions, each referencing only productIds from the trend data given. Set targetChurnTier to "High" only for a genuine win-back idea aimed at at-risk customers, otherwise null. These are suggestions only — never claim a campaign has been launched.
Keep narratives to 2-3 sentences each, concise and concrete (cite real numbers).`;

function buildContext(trends: TrendPoint[], anomalies: AnomalyPoint[]): string {
  return JSON.stringify({
    trends: trends.map((t) => ({ productId: t.productId, productName: t.productName, currentRevenue: t.currentRevenue, priorRevenue: t.priorRevenue, growthPercent: t.growthPercent, isNew: t.isNew })),
    anomalies,
    dataLimitation: "Only order volume is tracked — no site traffic or conversion-funnel data exists in this system.",
  });
}

async function generateStructuredResponse(trends: TrendPoint[], anomalies: AnomalyPoint[]): Promise<{ parsed: StructuredResponse; promptTokens: number; completionTokens: number }> {
  const messages: ChatCompletionMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Data (JSON): ${buildContext(trends, anomalies)}` },
  ];
  const result = await chatProvider.generateResponse(messages, { jsonSchema: RESPONSE_SCHEMA });
  const parsed = JSON.parse(result.content) as StructuredResponse;
  return { parsed, promptTokens: result.promptTokens, completionTokens: result.completionTokens };
}

export interface RecomputeInsightsResult {
  generated: boolean;
  trendCount: number;
  anomalyCount: number;
  suggestionCount: number;
}

export async function recomputeInsights(adminUserId: string): Promise<RecomputeInsightsResult> {
  await requirePermission(adminUserId, "CRMAnalytics", "Edit");

  const to = new Date();
  const from = new Date(to.getTime() - 30 * DAY_MS);

  const [trends, anomalies] = await Promise.all([computeTrends(from, to), computeAnomalies(from, to)]);
  const candidateProductIds = new Set(trends.map((t) => t.productId));

  try {
    const { parsed } = await generateStructuredResponse(trends, anomalies);

    // Guardrail: only trust product ids that were actually in the real candidate set given,
    // same defense-in-depth pattern as 062/063's recommendedRecipeIds/referencedOrderNumbers.
    const validSuggestions = parsed.campaignSuggestions.map((s) => ({ ...s, productIds: s.productIds.filter((id) => candidateProductIds.has(id)) }));

    await aiInsightsRepository.createSnapshots([
      {
        periodStart: from,
        periodEnd: to,
        metricType: "Trend",
        narrativeText: parsed.trendNarrative,
        sourceQueryRef: { type: "product_trend", productIds: trends.map((t) => t.productId) },
      },
      {
        periodStart: from,
        periodEnd: to,
        metricType: "Anomaly",
        narrativeText: parsed.anomalyNarrative,
        sourceQueryRef: { type: "daily_order_anomaly", anomalyDates: anomalies.map((a) => a.date) },
      },
      ...validSuggestions.map((s, index) => ({
        periodStart: from,
        periodEnd: to,
        metricType: "CampaignSuggestion" as const,
        narrativeText: s.rationale,
        sourceQueryRef: { type: "campaign_suggestion", productIds: s.productIds, targetChurnTier: s.targetChurnTier },
        structuredPayload: { title: s.title, rationale: s.rationale, suggestedProductIds: s.productIds, targetChurnTier: s.targetChurnTier },
        sequence: index,
      })),
    ]);

    await writeAuditLog({ actorId: adminUserId, action: "business_insights_recomputed", module: "CRMAnalytics", metadata: { trendCount: trends.length, anomalyCount: anomalies.length, suggestionCount: validSuggestions.length } });

    return { generated: true, trendCount: trends.length, anomalyCount: anomalies.length, suggestionCount: validSuggestions.length };
  } catch (error) {
    // Same transparent-fallback standard as 061-063: never crash, no rows written,
    // the panel's "last updated" timestamp simply doesn't advance.
    console.error("[business-insights] failed to generate insights", error);
    return { generated: false, trendCount: 0, anomalyCount: 0, suggestionCount: 0 };
  }
}

export interface CampaignSuggestionPayload {
  title: string;
  rationale: string;
  suggestedProductIds: string[];
  targetChurnTier: ChurnRiskTier | null;
}

export async function getLatestInsights(adminUserId: string) {
  await requirePermission(adminUserId, "CRMAnalytics", "View");
  const [trend, anomaly, suggestions] = await Promise.all([
    aiInsightsRepository.findLatestSnapshotByType("Trend"),
    aiInsightsRepository.findLatestSnapshotByType("Anomaly"),
    aiInsightsRepository.findLatestCampaignSuggestions(),
  ]);
  return {
    trend: trend ? { narrativeText: trend.narrativeText, generatedAt: trend.generatedAt, sourceQueryRef: trend.sourceQueryRef } : null,
    anomaly: anomaly ? { narrativeText: anomaly.narrativeText, generatedAt: anomaly.generatedAt, sourceQueryRef: anomaly.sourceQueryRef } : null,
    campaignSuggestions: suggestions.map((s) => ({
      id: s.id,
      narrativeText: s.narrativeText,
      structuredPayload: s.structuredPayload as unknown as CampaignSuggestionPayload | null,
      generatedAt: s.generatedAt,
    })),
  };
}
