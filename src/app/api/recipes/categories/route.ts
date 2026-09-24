import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { listRecipeFacets } from "@/services/recipe.service";

/** The category chip row and the dietary filter options, in one call. */
export async function GET() {
  try {
    return NextResponse.json(await listRecipeFacets());
  } catch (error) {
    return serverErrorResponse(error, "GET /api/recipes/categories");
  }
}
