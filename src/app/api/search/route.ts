import { NextResponse } from "next/server";

import { searchCatalogue } from "@/services/search.service";
import { searchQuerySchema } from "@/validation/search.schema";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawQuery = Object.fromEntries(url.searchParams);
  const query = searchQuerySchema.parse(rawQuery);

  const result = await searchCatalogue(query.q, { page: query.page, pageSize: query.pageSize });

  return NextResponse.json(result, { status: 200 });
}
