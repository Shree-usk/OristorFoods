import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { PermissionDeniedError } from "@/services/permission.errors";
import { ProductTaxonomyError, type ProductTaxonomyErrorCode } from "@/services/product-taxonomy.errors";

const statusByCode: Record<ProductTaxonomyErrorCode, number> = {
  allergen_not_found: 404,
  allergen_name_conflict: 409,
  certification_not_found: 404,
};

/** Every /api/admin/{allergens,certifications}/* route handler's catch block goes through this. */
export function productTaxonomyErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof ProductTaxonomyError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
