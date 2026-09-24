import { NextResponse } from "next/server";
import { z } from "zod";

/** Shared by the reviews and questions route handlers. */
export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function validationErrorResponse(error: z.ZodError) {
  return NextResponse.json(
    { error: error.issues[0]?.message ?? "Invalid input", fieldErrors: z.flattenError(error).fieldErrors },
    { status: 400 },
  );
}

/**
 * For unexpected failures: logs the real error server-side (with a context
 * label such as "GET /api/recipes") and returns a generic 500 body, so no
 * internal detail reaches the browser.
 */
export function serverErrorResponse(error: unknown, context: string) {
  console.error(`[${context}]`, error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
