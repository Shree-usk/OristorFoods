import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { analyticsErrorResponse } from "@/lib/api/analytics-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { deleteScheduledReport, updateScheduledReport } from "@/services/scheduled-report.service";
import { updateScheduledReportSchema } from "@/validation/executive-dashboard.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updateScheduledReportSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updateScheduledReport(session.user.id, id, parsed.data));
  } catch (error) {
    return analyticsErrorResponse(error, "PATCH /api/admin/analytics/scheduled-reports/[id]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    await deleteScheduledReport(session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return analyticsErrorResponse(error, "DELETE /api/admin/analytics/scheduled-reports/[id]");
  }
}
