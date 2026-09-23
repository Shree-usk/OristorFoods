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
