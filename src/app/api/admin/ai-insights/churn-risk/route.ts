import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { aiInsightsErrorResponse } from "@/lib/api/ai-insights-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { listChurnScores } from "@/services/churn-scoring.service";
import { listChurnScoresQuerySchema } from "@/validation/ai-insights.schema";

export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const parsed = listChurnScoresQuerySchema.safeParse({
    riskTier: searchParams.get("riskTier") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await listChurnScores(session.user.id, parsed.data));
  } catch (error) {
    return aiInsightsErrorResponse(error, "GET /api/admin/ai-insights/churn-risk");
  }
}
