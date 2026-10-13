import { NextResponse } from "next/server";

import { getPickupLocation } from "@/services/system-settings.service";

/** Export fulfilment flow. Null until an admin has configured a pickup location — the Pickup choice disables itself rather than showing a fabricated address. */
export async function GET() {
  const location = await getPickupLocation();
  return NextResponse.json(location);
}
