import { NextResponse } from "next/server";

import { authErrorResponse } from "@/lib/api/auth-responses";
import { REFERRAL_COOKIE_NAME } from "@/lib/api/referral-cookie";
import { validationErrorResponse } from "@/lib/api/responses";
import { registerCustomer } from "@/services/auth.service";
import { registerSchema } from "@/validation/auth.schema";

/**
 * STORY-033. The client signs the caller in via next-auth/react's
 * signIn() right after this succeeds — this route only creates the row.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    await registerCustomer(parsed.data, request);
  } catch (error) {
    return authErrorResponse(error);
  }

  const response = NextResponse.json({ ok: true }, { status: 201 });
  response.cookies.delete(REFERRAL_COOKIE_NAME);
  return response;
}
