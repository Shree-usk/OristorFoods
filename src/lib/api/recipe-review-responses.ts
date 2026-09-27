import { NextResponse } from "next/server";

import { RecipeReviewServiceError, type RecipeReviewErrorCode } from "@/services/recipe-review.errors";

const statusByCode: Record<RecipeReviewErrorCode, number> = {
  invalid_input: 400,
  recipe_not_found: 404,
  review_not_found: 404,
  forbidden: 403,
  duplicate: 409,
  not_editable: 409,
  invalid_transition: 409,
};

/** Maps a recipe review service error to its HTTP response; anything else is rethrown (500). */
export function recipeReviewErrorResponse(error: unknown) {
  if (error instanceof RecipeReviewServiceError) {
    return NextResponse.json({ error: error.message }, { status: statusByCode[error.code] });
  }
  throw error;
}
