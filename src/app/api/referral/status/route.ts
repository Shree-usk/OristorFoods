import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api/responses";
import { getReferralStatusForUser } from "@/services/referral.service";

/** Session-only (STORY-031) — consumed by STORY-035's future referral dashboard. */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const referrals = await getReferralStatusForUser(userId);
  return NextResponse.json({ referrals });
}
