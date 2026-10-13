import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { orderAdminErrorResponse } from "@/lib/api/order-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { markOrderReadyForPickup } from "@/services/order-admin.service";

/** Export fulfilment flow. Only legal for a Pickup-fulfilment order — see order-admin.service.ts. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const order = await markOrderReadyForPickup(session.user.id, id);
    return NextResponse.json(order);
  } catch (error) {
    return orderAdminErrorResponse(error, "POST /api/admin/orders/[id]/ready-for-pickup");
  }
}
