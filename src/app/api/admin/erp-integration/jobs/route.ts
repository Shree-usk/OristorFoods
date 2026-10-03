import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { syncJobErrorResponse } from "@/lib/api/sync-job-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { listJobsForAdmin, triggerSync } from "@/services/sync-job.service";
import { syncJobFiltersSchema, triggerSyncSchema } from "@/validation/sync-job.schema";

export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const url = new URL(request.url);
  const parsed = syncJobFiltersSchema.safeParse({
    jobType: url.searchParams.get("jobType") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
    targetEntityId: url.searchParams.get("targetEntityId") ?? undefined,
  });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await listJobsForAdmin(session.user.id, parsed.data));
  } catch (error) {
    return syncJobErrorResponse(error, "GET /api/admin/erp-integration/jobs");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = triggerSyncSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const job = await triggerSync(session.user.id, parsed.data);
    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    return syncJobErrorResponse(error, "POST /api/admin/erp-integration/jobs");
  }
}
