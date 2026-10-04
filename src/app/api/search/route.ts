import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getOrCreateSessionId } from "@/lib/recommendation-session";
import { resolveCustomerGroupForUser } from "@/services/pricing.service";
import { getSmartSearchResults } from "@/services/smart-search.service";
import { searchQuerySchema } from "@/validation/search.schema";

/**
 * STORY-061. The full, semantic-blended search (<500ms target) — now
 * triggers a real paid OpenAI call per request, so this route is
 * rate-limited (checkRateLimit, the same primitive login/password-reset
 * already use — not a new mechanism). Autocomplete (<150ms,
 * keyword-only, no AI cost) is the separate GET /api/search/autocomplete.
 */
const SEARCH_RATE_LIMIT = { max: 20, windowMs: 60 * 1000 };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawQuery = Object.fromEntries(url.searchParams);
  const query = searchQuerySchema.parse(rawQuery);
  const session = await auth();
  const customerId = session?.user?.id ?? null;

  const rateLimitKey = customerId
    ? `search:${customerId}`
    : `search:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous"}`;
  if (!checkRateLimit(rateLimitKey, SEARCH_RATE_LIMIT)) {
    return NextResponse.json({ error: "Too many search requests. Please try again shortly." }, { status: 429 });
  }

  const customerGroup = await resolveCustomerGroupForUser(customerId);
  const sessionId = customerId ? null : await getOrCreateSessionId();

  const result = await getSmartSearchResults(query.q, { customerGroup, customerId, sessionId });

  return NextResponse.json(result, { status: 200 });
}
