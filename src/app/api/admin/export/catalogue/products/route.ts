import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { exportCatalogueAdminErrorResponse } from "@/lib/api/export-catalogue-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { listExportCatalogueProductsForAdmin } from "@/services/export-catalogue.service";
import { exportCatalogueAdminListQuerySchema } from "@/validation/export-catalogue-admin.schema";

export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const url = new URL(request.url);
  const parsed = exportCatalogueAdminListQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const { page, ...filters } = parsed.data;
    const result = await listExportCatalogueProductsForAdmin(session.user.id, filters, page ?? 1);
    return NextResponse.json(result);
  } catch (error) {
    return exportCatalogueAdminErrorResponse(error, "GET /api/admin/export/catalogue/products");
  }
}
