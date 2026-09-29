import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { requestAccountDeactivation } from "@/services/profile.service";
import { deactivateAccountSchema } from "@/validation/profile.schema";

/**
 * STORY-034. A soft-delete REQUEST only — flips User.status to
 * DeactivationRequested and records the reason; it does not sign the
 * customer out, block login, or hard-delete anything. Full deactivation
 * enforcement is a future admin action (the `Deactivated` status exists
 * for that, unused by this route).
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const body: unknown = await request.json();
  const parsed = deactivateAccountSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  await requestAccountDeactivation(userId, parsed.data.reason || null);
  return NextResponse.json({ ok: true });
}
