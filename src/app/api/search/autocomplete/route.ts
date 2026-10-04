import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { resolveCustomerGroupForUser } from "@/services/pricing.service";
import { searchCatalogue } from "@/services/search.service";
import { searchQuerySchema } from "@/validation/search.schema";

/**
 * STORY-061. The low-latency autocomplete path (<150ms target) — calls
 * the existing, untouched keyword-only searchCatalogue, never the
 * semantic-blended getSmartSearchResults. An embedding round-trip on
 * every keystroke would blow this budget; the full-search budget
 * (<500ms) is GET /api/search instead. See
 * docs/architecture-decisions.md.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawQuery = Object.fromEntries(url.searchParams);
  const query = searchQuerySchema.parse(rawQuery);
  const session = await auth();
  const customerGroup = await resolveCustomerGroupForUser(session?.user?.id ?? null);

  const result = await searchCatalogue(query.q, { page: query.page, pageSize: query.pageSize, customerGroup });

  return NextResponse.json(result, { status: 200 });
}
