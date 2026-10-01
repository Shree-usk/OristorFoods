import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { reviewModerationErrorResponse } from "@/lib/api/review-moderation-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { hide } from "@/services/review-moderation.service";
import { moderationSourceTypeSchema } from "@/validation/review-moderation.schema";

export async function POST(_request: Request, { params }: { params: Promise<{ sourceType: string; id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { sourceType, id } = await params;
  const parsed = moderationSourceTypeSchema.safeParse(sourceType);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const item = await hide(session.user.id, parsed.data, id);
    return NextResponse.json(item);
  } catch (error) {
    return reviewModerationErrorResponse(error, "POST /api/admin/reviews/[sourceType]/[id]/hide");
  }
}
