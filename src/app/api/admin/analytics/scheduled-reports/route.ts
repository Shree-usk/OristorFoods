import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { analyticsErrorResponse } from "@/lib/api/analytics-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createScheduledReport, listScheduledReports } from "@/services/scheduled-report.service";
import { scheduledReportSchema } from "@/validation/executive-dashboard.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listScheduledReports(session.user.id));
  } catch (error) {
    return analyticsErrorResponse(error, "GET /api/admin/analytics/scheduled-reports");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = scheduledReportSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const report = await createScheduledReport(session.user.id, parsed.data);
    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    return analyticsErrorResponse(error, "POST /api/admin/analytics/scheduled-reports");
  }
}
