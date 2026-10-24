import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { homepageBuilderErrorResponse } from "@/lib/api/homepage-builder-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { getExportHeroSettingForAdmin, updateExportHeroSettingForAdmin } from "@/services/export-hero.service";
import { exportHeroSettingSchema } from "@/validation/export-hero-admin.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await getExportHeroSettingForAdmin(session.user.id));
  } catch (error) {
    return homepageBuilderErrorResponse(error, "GET /api/admin/homepage-builder/export-hero");
  }
}

export async function PATCH(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = exportHeroSettingSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updateExportHeroSettingForAdmin(session.user.id, parsed.data));
  } catch (error) {
    return homepageBuilderErrorResponse(error, "PATCH /api/admin/homepage-builder/export-hero");
  }
}
