import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { orderAdminErrorResponse } from "@/lib/api/order-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { bulkChangeOrderStatus } from "@/services/order-admin.service";
import { bulkChangeOrderStatusSchema } from "@/validation/order-admin.schema";

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = bulkChangeOrderStatusSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const result = await bulkChangeOrderStatus(session.user.id, parsed.data.orderIds, parsed.data.status);
    return NextResponse.json(result);
  } catch (error) {
    return orderAdminErrorResponse(error, "POST /api/admin/orders/bulk-status");
  }
}
