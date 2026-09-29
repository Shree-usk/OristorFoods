import { NextResponse } from "next/server";

import { authErrorResponse } from "@/lib/api/auth-responses";
import { validationErrorResponse } from "@/lib/api/responses";
import { resetPassword } from "@/services/auth.service";
import { resetPasswordSchema } from "@/validation/auth.schema";

/** STORY-033. On success, every outstanding reset token AND every session issued before the reset are invalidated (auth.service.ts). */
export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    await resetPassword(parsed.data.email, parsed.data.token, parsed.data.password);
  } catch (error) {
    return authErrorResponse(error);
  }

  return NextResponse.json({ ok: true });
}
