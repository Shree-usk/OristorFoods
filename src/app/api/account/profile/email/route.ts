import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api/auth-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { requestEmailChange } from "@/services/profile.service";
import { changeEmailSchema } from "@/validation/profile.schema";

/** STORY-034. Sends a verification link to the NEW address — see /api/account/profile/email/confirm. */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const body: unknown = await request.json();
  const parsed = changeEmailSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    await requestEmailChange(userId, parsed.data.email);
  } catch (error) {
    return authErrorResponse(error);
  }

  return NextResponse.json({ ok: true });
}
