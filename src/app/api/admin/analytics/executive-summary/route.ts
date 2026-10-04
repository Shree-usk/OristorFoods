import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { analyticsErrorResponse } from "@/lib/api/analytics-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { getExecutiveSummary } from "@/services/executive-dashboard.service";
import { executiveSummaryQuerySchema } from "@/validation/executive-dashboard.schema";

export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const url = new URL(request.url);
  const parsed = executiveSummaryQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await getExecutiveSummary(session.user.id, parsed.data.from, parsed.data.to));
  } catch (error) {
    return analyticsErrorResponse(error, "GET /api/admin/analytics/executive-summary");
  }
}
