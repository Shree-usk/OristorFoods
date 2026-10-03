import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { CrmSegmentationError, type CrmSegmentationErrorCode } from "@/services/crm-segmentation.errors";
import { PermissionDeniedError, PermissionServiceError, type PermissionErrorCode } from "@/services/permission.errors";

const crmSegmentationStatusByCode: Record<CrmSegmentationErrorCode, number> = {
  not_found: 404,
};

const permissionStatusByCode: Record<PermissionErrorCode, number> = {
  permission_denied: 403,
  super_administrator_floor: 409,
  last_super_administrator: 409,
};

export function crmSegmentationErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof PermissionServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: permissionStatusByCode[error.code] });
  }
  if (error instanceof CrmSegmentationError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: crmSegmentationStatusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
