import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { ExportEnquiryError, type ExportEnquiryErrorCode } from "@/services/export-enquiry.errors";
import { PermissionDeniedError, PermissionServiceError, type PermissionErrorCode } from "@/services/permission.errors";

const exportEnquiryStatusByCode: Record<ExportEnquiryErrorCode, number> = {
  not_found: 404,
  invalid_status_transition: 409,
  not_won: 409,
};

const permissionStatusByCode: Record<PermissionErrorCode, number> = {
  permission_denied: 403,
  super_administrator_floor: 409,
  last_super_administrator: 409,
};

export function exportEnquiryErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof PermissionServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: permissionStatusByCode[error.code] });
  }
  if (error instanceof ExportEnquiryError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: exportEnquiryStatusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
