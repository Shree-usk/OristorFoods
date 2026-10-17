import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { exportCatalogueAdminErrorResponse } from "@/lib/api/export-catalogue-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { bulkSetExportVisibilityForAdmin } from "@/services/export-catalogue.service";
import { bulkSetExportVisibilitySchema } from "@/validation/export-catalogue-admin.schema";

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = bulkSetExportVisibilitySchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const result = await bulkSetExportVisibilityForAdmin(session.user.id, parsed.data.ids, parsed.data.isExportEnabled);
    return NextResponse.json(result);
  } catch (error) {
    return exportCatalogueAdminErrorResponse(error, "POST /api/admin/export/catalogue/products/bulk-visibility");
  }
}
