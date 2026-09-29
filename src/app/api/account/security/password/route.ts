import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { securityErrorResponse } from "@/lib/api/security-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { changePassword } from "@/services/security.service";
import { changePasswordSchema } from "@/validation/security.schema";

/**
 * STORY-034. On success, User.passwordChangedAt bumps (inside
 * changePassword -> userRepository.updatePassword), invalidating every
 * session including this one — the client re-authenticates after this
 * call. See security.service.ts's header comment for why "other sessions
 * only" isn't implemented (no per-session tracking exists).
 */
export async function PATCH(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const body: unknown = await request.json();
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    await changePassword(userId, parsed.data.currentPassword, parsed.data.newPassword);
  } catch (error) {
    return securityErrorResponse(error);
  }

  return NextResponse.json({ ok: true });
}
