import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { unauthorizedResponse, serverErrorResponse } from "@/lib/api/responses";
import { PermissionDeniedError, PermissionServiceError } from "@/services/permission.errors";
import { recomputeAllEmbeddings } from "@/services/embedding.service";

const permissionStatusByCode = { permission_denied: 403, super_administrator_floor: 409, last_super_administrator: 409 } as const;

/**
 * STORY-061. No cron exists in this codebase (same constraint
 * STORY-050d/STORY-059c/STORY-060 already resolved the same way) — a
 * real, callable recompute. Cooldown-rate-limited per admin so
 * repeated clicks can't fan out into a burst of real OpenAI calls —
 * the same unguarded-repeat-trigger gap STORY-060's own recompute
 * endpoint and STORY-059c's "process due" share, not repeated here.
 */
const RECOMPUTE_RATE_LIMIT = { max: 1, windowMs: 5 * 60 * 1000 };

export async function POST() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  if (!checkRateLimit(`search-recompute:${session.user.id}`, RECOMPUTE_RATE_LIMIT)) {
    return NextResponse.json({ error: "A recompute was already triggered recently. Please wait before retrying." }, { status: 429 });
  }

  try {
    const result = await recomputeAllEmbeddings(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PermissionDeniedError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof PermissionServiceError) return NextResponse.json({ error: error.message, code: error.code }, { status: permissionStatusByCode[error.code] });
    return serverErrorResponse(error, "POST /api/admin/search/recompute-embeddings");
  }
}
