import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { exportContentErrorResponse } from "@/lib/api/export-content-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { getPageHeroSettingForAdmin, updatePageHeroSetting } from "@/services/export-content.service";
import { exportPageHeroSettingSchema } from "@/validation/export-content.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await getPageHeroSettingForAdmin(session.user.id));
  } catch (error) {
    return exportContentErrorResponse(error, "GET /api/admin/export/page-hero");
  }
}

export async function PATCH(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = exportPageHeroSettingSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updatePageHeroSetting(session.user.id, parsed.data));
  } catch (error) {
    return exportContentErrorResponse(error, "PATCH /api/admin/export/page-hero");
  }
}
