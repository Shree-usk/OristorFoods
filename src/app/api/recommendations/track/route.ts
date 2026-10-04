import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { serverErrorResponse, validationErrorResponse } from "@/lib/api/responses";
import { getOrCreateSessionId } from "@/lib/recommendation-session";
import { trackRecommendationEvent } from "@/services/recommendation.service";
import { trackRecommendationSchema } from "@/validation/recommendation.schema";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = trackRecommendationSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const session = await auth();
    const customerId = session?.user?.id ?? null;
    const sessionId = customerId ? null : await getOrCreateSessionId();

    await trackRecommendationEvent({ customerId, sessionId, ...parsed.data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverErrorResponse(error, "POST /api/recommendations/track");
  }
}
