import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { deliveryZoneErrorResponse } from "@/lib/api/delivery-zone-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { bulkImportDeliveryZones } from "@/services/delivery-zone.service";
import { bulkImportDeliveryZonesSchema } from "@/validation/delivery-zone.schema";

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = bulkImportDeliveryZonesSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const result = await bulkImportDeliveryZones(session.user.id, parsed.data.csv);
    return NextResponse.json(result);
  } catch (error) {
    return deliveryZoneErrorResponse(error, "POST /api/admin/delivery-zones/bulk-import");
  }
}
