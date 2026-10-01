import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { reviewModerationErrorResponse } from "@/lib/api/review-moderation-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { bulkModerate } from "@/services/review-moderation.service";
import { bulkModerationSchema } from "@/validation/review-moderation.schema";

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = bulkModerationSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const result = await bulkModerate(session.user.id, parsed.data.items, parsed.data.action);
    return NextResponse.json(result);
  } catch (error) {
    return reviewModerationErrorResponse(error, "POST /api/admin/reviews/bulk");
  }
}
