import { NextResponse } from "next/server";

import { getSearchSuggestions } from "@/services/search.service";
import { productSearchQuerySchema } from "@/validation/product-search.schema";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawQuery = Object.fromEntries(url.searchParams);
  const { q } = productSearchQuerySchema.pick({ q: true }).parse(rawQuery);

  const suggestions = await getSearchSuggestions(q);

  return NextResponse.json(suggestions, { status: 200 });
}
