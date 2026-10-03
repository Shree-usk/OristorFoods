import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { systemSettingsErrorResponse } from "@/lib/api/system-settings-responses";
import { getTaxSettings, updateTaxDisplayMode } from "@/services/system-settings.service";
import { taxDisplayModeSchema } from "@/validation/system-settings.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await getTaxSettings(session.user.id));
  } catch (error) {
    return systemSettingsErrorResponse(error, "GET /api/admin/settings/taxes");
  }
}

export async function PATCH(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = taxDisplayModeSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updateTaxDisplayMode(session.user.id, parsed.data.pricingDisplayMode));
  } catch (error) {
    return systemSettingsErrorResponse(error, "PATCH /api/admin/settings/taxes");
  }
}
