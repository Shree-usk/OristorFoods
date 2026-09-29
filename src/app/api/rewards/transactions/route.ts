import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api/responses";
import { listTransactionsForUser } from "@/services/rewards.service";
import { listRewardTransactionsQuerySchema } from "@/validation/rewards.schema";

/** Session-only (STORY-030) — consumed by STORY-035's future wallet dashboard. */
export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const { page, pageSize } = listRewardTransactionsQuerySchema.parse(Object.fromEntries(searchParams));

  const result = await listTransactionsForUser(userId, page, pageSize);
  return NextResponse.json(result);
}
