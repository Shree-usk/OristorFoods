import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { reviewErrorResponse, unauthorizedResponse } from "@/lib/api/review-responses";
import { getMyReview } from "@/services/review.service";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { slug } = await params;
  try {
    return NextResponse.json({ review: await getMyReview(session.user.id, slug) }, { status: 200 });
  } catch (error) {
    return reviewErrorResponse(error);
  }
}
