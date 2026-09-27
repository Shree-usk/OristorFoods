import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { recipeReviewErrorResponse } from "@/lib/api/recipe-review-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { getMyReview } from "@/services/recipe-review.service";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { slug } = await params;
  try {
    return NextResponse.json({ review: await getMyReview(session.user.id, slug) }, { status: 200 });
  } catch (error) {
    return recipeReviewErrorResponse(error);
  }
}
