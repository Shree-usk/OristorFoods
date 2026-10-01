import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { orderAdminErrorResponse } from "@/lib/api/order-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { processReturn } from "@/services/order-admin.service";
import { processReturnSchema } from "@/validation/order-admin.schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = processReturnSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const result = await processReturn(session.user.id, id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return orderAdminErrorResponse(error, "POST /api/admin/orders/[id]/return");
  }
}
