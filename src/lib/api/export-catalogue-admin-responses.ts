import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { PermissionDeniedError, PermissionServiceError, type PermissionErrorCode } from "@/services/permission.errors";

const permissionStatusByCode: Record<PermissionErrorCode, number> = {
  permission_denied: 403,
  super_administrator_floor: 409,
  last_super_administrator: 409,
};

/** No export-catalogue-specific domain errors exist yet (plain CRUD, no conflict/not-found cases) — this only maps the shared permission errors, same shape as export-enquiry-responses.ts minus ExportEnquiryError. */
export function exportCatalogueAdminErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof PermissionServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: permissionStatusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
