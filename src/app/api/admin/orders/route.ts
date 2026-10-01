import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { orderAdminErrorResponse } from "@/lib/api/order-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { listOrdersForAdmin } from "@/services/order-admin.service";
import { listOrdersAdminQuerySchema } from "@/validation/order-admin.schema";

export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const parsed = listOrdersAdminQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const { page, pageSize, status, paymentStatus, dateFrom, dateTo, search } = parsed.data;

  try {
    const result = await listOrdersForAdmin(session.user.id, { status, paymentStatus, dateFrom, dateTo, search }, page, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    return orderAdminErrorResponse(error, "GET /api/admin/orders");
  }
}
