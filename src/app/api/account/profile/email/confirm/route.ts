import { NextResponse } from "next/server";

import { authErrorResponse } from "@/lib/api/auth-responses";
import { validationErrorResponse } from "@/lib/api/responses";
import { confirmEmailChange } from "@/services/profile.service";
import { confirmEmailChangeSchema } from "@/validation/profile.schema";

/** STORY-034. Unauthenticated-allowed, same as password reset — the mailed token+userId pair is the credential, not the session. */
export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = confirmEmailChangeSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    await confirmEmailChange(parsed.data.userId, parsed.data.token);
  } catch (error) {
    return authErrorResponse(error);
  }

  return NextResponse.json({ ok: true });
}
