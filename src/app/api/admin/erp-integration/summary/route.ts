import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { syncJobErrorResponse } from "@/lib/api/sync-job-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { getTodaySummary } from "@/services/sync-job.service";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await getTodaySummary(session.user.id));
  } catch (error) {
    return syncJobErrorResponse(error, "GET /api/admin/erp-integration/summary");
  }
}
