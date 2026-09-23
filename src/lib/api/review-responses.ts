import { NextResponse } from "next/server";
import { z } from "zod";

import { ReviewServiceError, type ReviewErrorCode } from "@/services/review.errors";

const statusByCode: Record<ReviewErrorCode, number> = {
  invalid_input: 400,
  product_not_found: 404,
  review_not_found: 404,
  forbidden: 403,
  duplicate: 409,
  not_editable: 409,
  invalid_transition: 409,
};

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function validationErrorResponse(error: z.ZodError) {
  return NextResponse.json(
    { error: error.issues[0]?.message ?? "Invalid input", fieldErrors: z.flattenError(error).fieldErrors },
    { status: 400 },
  );
}

/** Maps a review service error to its HTTP response; anything else is rethrown (500). */
export function reviewErrorResponse(error: unknown) {
  if (error instanceof ReviewServiceError) {
    return NextResponse.json({ error: error.message }, { status: statusByCode[error.code] });
  }
  throw error;
}
