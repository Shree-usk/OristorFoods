import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { reviewErrorResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api/review-responses";
import { editOwnPendingReview, withdrawOwnPendingReview } from "@/services/review.service";
import { reviewInputSchema } from "@/validation/review.schema";

type RouteContext = { params: Promise<{ slug: string; reviewId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { slug, reviewId } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = reviewInputSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const review = await editOwnPendingReview(session.user.id, slug, reviewId, parsed.data);
    return NextResponse.json({ review }, { status: 200 });
  } catch (error) {
    return reviewErrorResponse(error);
  }
}

/** Withdraws (deletes) the signed-in customer's own Pending review. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { slug, reviewId } = await params;
  try {
    await withdrawOwnPendingReview(session.user.id, slug, reviewId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return reviewErrorResponse(error);
  }
}
