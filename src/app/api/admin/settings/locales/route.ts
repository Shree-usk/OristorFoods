import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { systemSettingsErrorResponse } from "@/lib/api/system-settings-responses";
import { getLocaleSetting, updateLocaleSetting } from "@/services/system-settings.service";
import { localeSettingSchema } from "@/validation/system-settings.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await getLocaleSetting(session.user.id));
  } catch (error) {
    return systemSettingsErrorResponse(error, "GET /api/admin/settings/locales");
  }
}

export async function PATCH(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = localeSettingSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updateLocaleSetting(session.user.id, parsed.data));
  } catch (error) {
    return systemSettingsErrorResponse(error, "PATCH /api/admin/settings/locales");
  }
}
