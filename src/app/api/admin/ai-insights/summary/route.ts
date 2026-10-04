import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { aiInsightsErrorResponse } from "@/lib/api/ai-insights-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { getLatestInsights } from "@/services/business-insights.service";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await getLatestInsights(session.user.id));
  } catch (error) {
    return aiInsightsErrorResponse(error, "GET /api/admin/ai-insights/summary");
  }
}
