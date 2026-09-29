import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api/responses";
import { getPointHistoryPage } from "@/services/customer-rewards-dashboard.service";
import { listRewardTransactionsQuerySchema } from "@/validation/rewards.schema";

/**
 * STORY-035. Distinct from STORY-030's existing `/api/rewards/transactions`
 * — that route's shape has no running balance, and extending it would
 * change a contract STORY-030 owns. This one exists only to serve
 * `/account/rewards`'s history table (client-side pagination beyond the
 * server-rendered first page).
 */
export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const { page, pageSize } = listRewardTransactionsQuerySchema.parse(Object.fromEntries(searchParams));

  const result = await getPointHistoryPage(userId, page, pageSize);
  return NextResponse.json(result);
}
