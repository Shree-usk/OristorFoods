import { NextResponse } from "next/server";

import { PermissionDeniedError } from "@/services/permission.errors";
import { ProductAdminError, type ProductAdminErrorCode } from "@/services/product-admin.errors";
import { serverErrorResponse } from "@/lib/api/responses";

const statusByCode: Record<ProductAdminErrorCode, number> = {
  not_found: 404,
  slug_conflict: 409,
  sku_conflict: 409,
  illegal_transition: 409,
};

/** Every /api/admin/products/* route handler's catch block goes through this. */
export function productAdminErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof ProductAdminError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
