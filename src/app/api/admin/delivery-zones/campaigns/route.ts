import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { deliveryZoneErrorResponse } from "@/lib/api/delivery-zone-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { listCampaignOptions } from "@/services/delivery-zone.service";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listCampaignOptions(session.user.id));
  } catch (error) {
    return deliveryZoneErrorResponse(error, "GET /api/admin/delivery-zones/campaigns");
  }
}
