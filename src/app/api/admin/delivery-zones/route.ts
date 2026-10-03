import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { deliveryZoneErrorResponse } from "@/lib/api/delivery-zone-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createZone, listZonesForAdmin } from "@/services/delivery-zone.service";
import { deliveryZoneInputSchema } from "@/validation/delivery-zone.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listZonesForAdmin(session.user.id));
  } catch (error) {
    return deliveryZoneErrorResponse(error, "GET /api/admin/delivery-zones");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = deliveryZoneInputSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const zone = await createZone(session.user.id, parsed.data);
    return NextResponse.json(zone, { status: 201 });
  } catch (error) {
    return deliveryZoneErrorResponse(error, "POST /api/admin/delivery-zones");
  }
}
