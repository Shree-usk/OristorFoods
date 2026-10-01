import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { reviewModerationErrorResponse } from "@/lib/api/review-moderation-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { listModerationQueue } from "@/services/review-moderation.service";
import { listModerationQueueQuerySchema } from "@/validation/review-moderation.schema";

export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const parsed = listModerationQueueQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const { page, pageSize, sourceType, status, rating, search } = parsed.data;

  try {
    const result = await listModerationQueue(session.user.id, { sourceType, status, rating, search }, page, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    return reviewModerationErrorResponse(error, "GET /api/admin/reviews");
  }
}
