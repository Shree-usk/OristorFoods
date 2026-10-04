import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { aiInsightsErrorResponse } from "@/lib/api/ai-insights-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { checkRateLimit } from "@/lib/rate-limit";
import { recomputeChurnScores } from "@/services/churn-scoring.service";

/**
 * STORY-064. No cron exists in this codebase (same constraint
 * STORY-050d/059c/060/061/063 already resolved the same way) — a real,
 * callable recompute. Cooldown-rate-limited (checkRateLimit's max:1 +
 * windowMs pattern, same mechanism as 060/061's recompute routes — no
 * dedicated cooldown API exists). Kept as its own action, separate from
 * recompute-insights: a full RFM pass over the customer base and a paid
 * LLM narrative call have different cost/latency profiles.
 */
const RECOMPUTE_RATE_LIMIT = { max: 1, windowMs: 5 * 60 * 1000 };

export async function POST() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  if (!checkRateLimit(`churn-recompute:${session.user.id}`, RECOMPUTE_RATE_LIMIT)) {
    return NextResponse.json({ error: "A churn recompute was already triggered recently. Please wait before retrying." }, { status: 429 });
  }

  try {
    return NextResponse.json(await recomputeChurnScores(session.user.id));
  } catch (error) {
    return aiInsightsErrorResponse(error, "POST /api/admin/ai-insights/recompute-churn");
  }
}
