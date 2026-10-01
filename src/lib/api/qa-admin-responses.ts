import { NextResponse } from "next/server";

import { PermissionDeniedError } from "@/services/permission.errors";
import { QaServiceError, type QaErrorCode } from "@/services/qa.errors";
import { serverErrorResponse } from "@/lib/api/responses";

const statusByCode: Record<QaErrorCode, number> = {
  invalid_input: 400,
  product_not_found: 404,
  question_not_found: 404,
  invalid_transition: 409,
};

/** Every /api/admin/questions/* route handler's catch block goes through this. */
export function qaAdminErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof QaServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
