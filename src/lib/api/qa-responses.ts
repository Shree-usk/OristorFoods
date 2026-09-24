import { NextResponse } from "next/server";

import { QaServiceError, type QaErrorCode } from "@/services/qa.errors";

const statusByCode: Record<QaErrorCode, number> = {
  invalid_input: 400,
  product_not_found: 404,
  question_not_found: 404,
  invalid_transition: 409,
};

/** Maps a Q&A service error to its HTTP response; anything else is rethrown (500). */
export function qaErrorResponse(error: unknown) {
  if (error instanceof QaServiceError) {
    return NextResponse.json({ error: error.message }, { status: statusByCode[error.code] });
  }
  throw error;
}
