import { NextResponse } from "next/server";

import { validationErrorResponse } from "@/lib/api/responses";
import { requestPasswordReset } from "@/services/auth.service";
import { forgotPasswordSchema } from "@/validation/auth.schema";

/** STORY-033. Always 200 — never reveals whether the email is registered. */
export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  await requestPasswordReset(parsed.data.email);
  return NextResponse.json({ ok: true });
}
