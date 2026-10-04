import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { aiInsightsErrorResponse } from "@/lib/api/ai-insights-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { exportChurnTierToSegment } from "@/services/churn-scoring.service";
import { exportChurnTierSchema } from "@/validation/ai-insights.schema";

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = exportChurnTierSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const segment = await exportChurnTierToSegment(session.user.id, parsed.data.riskTier);
    return NextResponse.json(segment, { status: 201 });
  } catch (error) {
    return aiInsightsErrorResponse(error, "POST /api/admin/ai-insights/export-churn-segment");
  }
}
