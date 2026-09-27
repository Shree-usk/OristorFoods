import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { recipeReviewErrorResponse } from "@/lib/api/recipe-review-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { listApprovedReviews, submitReview } from "@/services/recipe-review.service";
import { recipeReviewInputSchema, recipeReviewListQuerySchema } from "@/validation/recipe-review.schema";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const parsed = recipeReviewListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await listApprovedReviews(slug, parsed.data), { status: 200 });
  } catch (error) {
    return recipeReviewErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { slug } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = recipeReviewInputSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const review = await submitReview(session.user.id, slug, parsed.data);
    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    return recipeReviewErrorResponse(error);
  }
}
