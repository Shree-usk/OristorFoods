import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { GlossaryError, type GlossaryErrorCode } from "@/services/glossary.errors";
import { PermissionDeniedError, PermissionServiceError, type PermissionErrorCode } from "@/services/permission.errors";

const glossaryStatusByCode: Record<GlossaryErrorCode, number> = {
  not_found: 404,
  duplicate_term: 409,
};

const permissionStatusByCode: Record<PermissionErrorCode, number> = {
  permission_denied: 403,
  super_administrator_floor: 409,
  last_super_administrator: 409,
};

export function glossaryErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof PermissionServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: permissionStatusByCode[error.code] });
  }
  if (error instanceof GlossaryError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: glossaryStatusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
