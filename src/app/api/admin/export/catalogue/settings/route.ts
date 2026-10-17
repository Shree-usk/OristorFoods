import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { exportCatalogueAdminErrorResponse } from "@/lib/api/export-catalogue-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { getExportCatalogueSettingForAdmin, updateExportCatalogueSettingForAdmin } from "@/services/export-catalogue.service";
import { exportCatalogueSettingSchema } from "@/validation/export-catalogue-admin.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await getExportCatalogueSettingForAdmin(session.user.id));
  } catch (error) {
    return exportCatalogueAdminErrorResponse(error, "GET /api/admin/export/catalogue/settings");
  }
}

export async function PATCH(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = exportCatalogueSettingSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updateExportCatalogueSettingForAdmin(session.user.id, parsed.data));
  } catch (error) {
    return exportCatalogueAdminErrorResponse(error, "PATCH /api/admin/export/catalogue/settings");
  }
}
