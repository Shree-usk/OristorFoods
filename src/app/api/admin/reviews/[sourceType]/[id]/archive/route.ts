import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { unauthorizedResponse } from "@/lib/api/responses";
import { reviewModerationErrorResponse } from "@/lib/api/review-moderation-responses";
import { archive } from "@/services/review-moderation.service";

/** Product reviews only. */
export async function POST(_request: Request, { params }: { params: Promise<{ sourceType: string; id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { sourceType, id } = await params;
  if (sourceType !== "product") {
    return NextResponse.json({ error: "Only product reviews can be archived.", code: "illegal_transition" }, { status: 409 });
  }

  try {
    const item = await archive(session.user.id, id);
    return NextResponse.json(item);
  } catch (error) {
    return reviewModerationErrorResponse(error, "POST /api/admin/reviews/[sourceType]/[id]/archive");
  }
}
