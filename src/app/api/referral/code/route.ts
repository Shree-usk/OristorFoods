import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api/responses";
import { getOrCreateReferralCode } from "@/services/referral.service";

/** Session-only (STORY-031) — lazily generates the code on first request for any customer who registered before this feature existed. */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const code = await getOrCreateReferralCode(userId);
  return NextResponse.json({ code, link: `/?ref=${code}` });
}
