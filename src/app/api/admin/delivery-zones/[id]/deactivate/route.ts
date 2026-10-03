import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { deliveryZoneErrorResponse } from "@/lib/api/delivery-zone-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { setZoneActive } from "@/services/delivery-zone.service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    return NextResponse.json(await setZoneActive(session.user.id, id, false));
  } catch (error) {
    return deliveryZoneErrorResponse(error, "POST /api/admin/delivery-zones/[id]/deactivate");
  }
}
