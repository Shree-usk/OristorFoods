import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api/responses";
import { listOrdersForUser } from "@/services/order.service";
import { listOrdersQuerySchema } from "@/validation/order.schema";

/**
 * Session-only (STORY-028) — a guest has no durable identity to list
 * orders across visits; each guest order is reachable individually via
 * GET /api/orders/:orderNumber with its own cookie. Consumed by
 * STORY-036's future order-history dashboard.
 */
export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const { page, pageSize } = listOrdersQuerySchema.parse(Object.fromEntries(searchParams));

  const result = await listOrdersForUser(userId, page, pageSize);
  return NextResponse.json(result);
}
