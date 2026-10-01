import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { unauthorizedResponse } from "@/lib/api/responses";
import { reviewModerationErrorResponse } from "@/lib/api/review-moderation-responses";
import { restore } from "@/services/review-moderation.service";

/** Product reviews only — see review-moderation.service.ts's header comment on why recipe/blog-comment Hidden is terminal. */
export async function POST(_request: Request, { params }: { params: Promise<{ sourceType: string; id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { sourceType, id } = await params;
  if (sourceType !== "product") {
    return NextResponse.json({ error: "Only product reviews can be restored.", code: "illegal_transition" }, { status: 409 });
  }

  try {
    const item = await restore(session.user.id, id);
    return NextResponse.json(item);
  } catch (error) {
    return reviewModerationErrorResponse(error, "POST /api/admin/reviews/[sourceType]/[id]/restore");
  }
}
