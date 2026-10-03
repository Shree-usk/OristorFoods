import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { unauthorizedResponse } from "@/lib/api/responses";
import { versioningErrorResponse } from "@/lib/api/versioning-responses";
import { getMyReviewQueue } from "@/services/review-queue.service";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const items = await getMyReviewQueue(session.user.id);
    return NextResponse.json(items);
  } catch (error) {
    return versioningErrorResponse(error, "GET /api/admin/cms/my-queue");
  }
}
