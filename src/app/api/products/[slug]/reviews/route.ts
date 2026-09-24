import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { reviewErrorResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api/review-responses";
import { listPublishedReviews, submitReview } from "@/services/review.service";
import { reviewInputSchema, reviewListQuerySchema } from "@/validation/review.schema";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const parsed = reviewListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await listPublishedReviews(slug, parsed.data), { status: 200 });
  } catch (error) {
    return reviewErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { slug } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = reviewInputSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const review = await submitReview(session.user.id, slug, parsed.data);
    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    return reviewErrorResponse(error);
  }
}
