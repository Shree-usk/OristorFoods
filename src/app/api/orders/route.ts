import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api/responses";
import { getOrderListPage } from "@/services/customer-order-history.service";
import { listOrdersQuerySchema } from "@/validation/order.schema";

/**
 * Session-only (STORY-028) — a guest has no durable identity to list
 * orders across visits; each guest order is reachable individually via
 * GET /api/orders/:orderNumber with its own cookie. STORY-036: now backed
 * by customer-order-history.service.ts's getOrderListPage (adds optional
 * status/dateFrom/dateTo filters and item thumbnails) rather than
 * order.service.ts's own listOrdersForUser directly, since nothing else
 * consumed this route's previous shape — see docs/architecture-decisions.md.
 */
export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const { page, pageSize, status, dateFrom, dateTo } = listOrdersQuerySchema.parse(Object.fromEntries(searchParams));

  const result = await getOrderListPage(userId, page, pageSize, { status, dateFrom, dateTo });
  return NextResponse.json(result);
}
