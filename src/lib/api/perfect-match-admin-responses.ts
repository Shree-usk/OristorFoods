import { NextResponse } from "next/server";

import { PerfectMatchAdminError, type PerfectMatchAdminErrorCode } from "@/services/perfect-match-admin.errors";
import { PermissionDeniedError } from "@/services/permission.errors";
import { serverErrorResponse } from "@/lib/api/responses";

const statusByCode: Record<PerfectMatchAdminErrorCode, number> = {
  product_not_found: 404,
  product_already_added: 409,
  underlying_product_not_found: 404,
  pairing_not_found: 404,
  pairing_limit_exceeded: 409,
};

/** Every /api/admin/perfect-match/* route handler's catch block goes through this. */
export function perfectMatchAdminErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof PerfectMatchAdminError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
