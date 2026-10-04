import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { PolicyDocumentError, type PolicyDocumentErrorCode } from "@/services/policy-document.errors";
import { PermissionDeniedError, PermissionServiceError, type PermissionErrorCode } from "@/services/permission.errors";

const policyDocumentStatusByCode: Record<PolicyDocumentErrorCode, number> = {
  not_found: 404,
  duplicate_slug: 409,
};

const permissionStatusByCode: Record<PermissionErrorCode, number> = {
  permission_denied: 403,
  super_administrator_floor: 409,
  last_super_administrator: 409,
};

export function policyDocumentErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof PermissionServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: permissionStatusByCode[error.code] });
  }
  if (error instanceof PolicyDocumentError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: policyDocumentStatusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
