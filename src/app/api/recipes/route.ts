import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { listRecipes } from "@/services/recipe.service";
import { recipeListingQuerySchema } from "@/validation/recipe-listing.schema";

export async function GET(request: Request) {
  // Every field in the schema has a .catch() fallback, so parsing never throws.
  const query = recipeListingQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  try {
    return NextResponse.json(await listRecipes(query));
  } catch (error) {
    return serverErrorResponse(error, "GET /api/recipes");
  }
}
