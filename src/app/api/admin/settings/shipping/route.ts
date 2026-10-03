import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { systemSettingsErrorResponse } from "@/lib/api/system-settings-responses";
import { getFreeShippingThreshold, updateFreeShippingThreshold } from "@/services/system-settings.service";
import { freeShippingThresholdSchema } from "@/validation/system-settings.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const value = await getFreeShippingThreshold(session.user.id);
    return NextResponse.json({ freeShippingThreshold: value });
  } catch (error) {
    return systemSettingsErrorResponse(error, "GET /api/admin/settings/shipping");
  }
}

export async function PATCH(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = freeShippingThresholdSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const value = await updateFreeShippingThreshold(session.user.id, parsed.data.value);
    return NextResponse.json({ freeShippingThreshold: value });
  } catch (error) {
    return systemSettingsErrorResponse(error, "PATCH /api/admin/settings/shipping");
  }
}
