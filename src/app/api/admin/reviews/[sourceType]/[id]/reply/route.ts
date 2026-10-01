import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { reviewModerationErrorResponse } from "@/lib/api/review-moderation-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { reply } from "@/services/review-moderation.service";
import { moderationSourceTypeSchema, replySchema } from "@/validation/review-moderation.schema";

export async function POST(request: Request, { params }: { params: Promise<{ sourceType: string; id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { sourceType, id } = await params;
  const parsedSourceType = moderationSourceTypeSchema.safeParse(sourceType);
  if (!parsedSourceType.success) return validationErrorResponse(parsedSourceType.error);

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const item = await reply(session.user.id, parsedSourceType.data, id, parsed.data.body);
    return NextResponse.json(item);
  } catch (error) {
    return reviewModerationErrorResponse(error, "POST /api/admin/reviews/[sourceType]/[id]/reply");
  }
}
