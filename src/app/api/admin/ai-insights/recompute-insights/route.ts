import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { aiInsightsErrorResponse } from "@/lib/api/ai-insights-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { checkRateLimit } from "@/lib/rate-limit";
import { recomputeInsights } from "@/services/business-insights.service";

/** STORY-064. See recompute-churn/route.ts's comment — same pattern, separate rate-limit key/action since this triggers a real paid LLM call. */
const RECOMPUTE_RATE_LIMIT = { max: 1, windowMs: 5 * 60 * 1000 };

export async function POST() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  if (!checkRateLimit(`insight-narrative-recompute:${session.user.id}`, RECOMPUTE_RATE_LIMIT)) {
    return NextResponse.json({ error: "An insights recompute was already triggered recently. Please wait before retrying." }, { status: 429 });
  }

  try {
    return NextResponse.json(await recomputeInsights(session.user.id));
  } catch (error) {
    return aiInsightsErrorResponse(error, "POST /api/admin/ai-insights/recompute-insights");
  }
}
