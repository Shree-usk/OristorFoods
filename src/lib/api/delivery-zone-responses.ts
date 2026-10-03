import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { DeliveryZoneError, type DeliveryZoneErrorCode } from "@/services/delivery-zone.errors";
import { PermissionDeniedError } from "@/services/permission.errors";

const statusByCode: Record<DeliveryZoneErrorCode, number> = {
  city_conflict: 409,
  zone_not_found: 404,
  override_not_found: 404,
  override_validation: 422,
};

export function deliveryZoneErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof DeliveryZoneError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
