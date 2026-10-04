import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { unauthorizedResponse, serverErrorResponse } from "@/lib/api/responses";
import { PermissionDeniedError, PermissionServiceError } from "@/services/permission.errors";
import { recomputeProductAssociations } from "@/services/recommendation.service";

/**
 * STORY-060. No cron exists in this codebase (same constraint
 * STORY-050d/STORY-059c already resolved the same way) — a real,
 * callable recompute, triggerable via curl/an ops runbook today and a
 * real target for an actual cron once hosting is confirmed. No admin
 * console page exists for this; the AC never asked for one.
 */
export async function POST() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const result = await recomputeProductAssociations(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PermissionDeniedError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof PermissionServiceError) return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    return serverErrorResponse(error, "POST /api/admin/recommendations/recompute");
  }
}
