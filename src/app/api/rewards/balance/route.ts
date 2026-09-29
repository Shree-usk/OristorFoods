import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api/responses";
import { getBalanceForUser } from "@/services/rewards.service";

/** Session-only (STORY-030) — a guest has no ledger to read a balance from. */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const balance = await getBalanceForUser(userId);
  return NextResponse.json(balance);
}
