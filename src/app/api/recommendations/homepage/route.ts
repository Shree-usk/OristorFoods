import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/api/responses";
import { getOrCreateSessionId } from "@/lib/recommendation-session";
import { resolveCustomerGroupForUser } from "@/services/pricing.service";
import { getHomepageRecommendations } from "@/services/recommendation.service";

const LIMIT = 10;

export async function GET() {
  try {
    const session = await auth();
    const customerId = session?.user?.id ?? null;
    const customerGroup = await resolveCustomerGroupForUser(customerId);
    const sessionId = customerId ? null : await getOrCreateSessionId();

    const result = await getHomepageRecommendations({ customerId, sessionId, customerGroup, limit: LIMIT });
    return NextResponse.json(result);
  } catch (error) {
    return serverErrorResponse(error, "GET /api/recommendations/homepage");
  }
}
