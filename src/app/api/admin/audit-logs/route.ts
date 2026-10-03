import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { adminUserAdminErrorResponse } from "@/lib/api/admin-user-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { listAuditLogs } from "@/services/audit-log-admin.service";
import { auditLogFiltersSchema } from "@/validation/audit-log-admin.schema";

export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const url = new URL(request.url);
  const parsed = auditLogFiltersSchema.safeParse({
    actorId: url.searchParams.get("actorId") ?? undefined,
    module: url.searchParams.get("module") ?? undefined,
    action: url.searchParams.get("action") ?? undefined,
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
    targetId: url.searchParams.get("targetId") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
  });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const { page, ...filters } = parsed.data;
  try {
    return NextResponse.json(await listAuditLogs(session.user.id, filters, page ?? 1));
  } catch (error) {
    return adminUserAdminErrorResponse(error, "GET /api/admin/audit-logs");
  }
}
