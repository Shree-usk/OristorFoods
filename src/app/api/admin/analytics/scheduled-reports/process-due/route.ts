import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { analyticsErrorResponse } from "@/lib/api/analytics-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { processDueScheduledReports } from "@/services/scheduled-report.service";

export async function POST() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const result = await processDueScheduledReports(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    return analyticsErrorResponse(error, "POST /api/admin/analytics/scheduled-reports/process-due");
  }
}
