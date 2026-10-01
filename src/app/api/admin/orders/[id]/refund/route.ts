import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { orderAdminErrorResponse } from "@/lib/api/order-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { refundOrder } from "@/services/order-admin.service";
import { refundOrderSchema } from "@/validation/order-admin.schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = refundOrderSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const record = await refundOrder(session.user.id, id, parsed.data.amount, parsed.data.reason);
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    return orderAdminErrorResponse(error, "POST /api/admin/orders/[id]/refund");
  }
}
