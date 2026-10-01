import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { orderAdminErrorResponse } from "@/lib/api/order-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { changeOrderStatus } from "@/services/order-admin.service";
import { changeOrderStatusSchema } from "@/validation/order-admin.schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = changeOrderStatusSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const order = await changeOrderStatus(session.user.id, id, parsed.data.status);
    return NextResponse.json(order);
  } catch (error) {
    return orderAdminErrorResponse(error, "POST /api/admin/orders/[id]/status");
  }
}
