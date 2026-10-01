import { NextResponse } from "next/server";

import { PermissionDeniedError } from "@/services/permission.errors";
import { CustomerAdminServiceError, type CustomerAdminErrorCode } from "@/services/customer-admin.errors";
import { serverErrorResponse } from "@/lib/api/responses";

const statusByCode: Record<CustomerAdminErrorCode, number> = {
  customer_not_found: 404,
  already_suspended: 409,
  not_suspended: 409,
};

export function customerAdminErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof CustomerAdminServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
