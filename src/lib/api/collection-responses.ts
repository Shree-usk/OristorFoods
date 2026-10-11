import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { CollectionError, type CollectionErrorCode } from "@/services/collection.errors";
import { PermissionDeniedError } from "@/services/permission.errors";

const statusByCode: Record<CollectionErrorCode, number> = {
  collection_not_found: 404,
  collection_slug_conflict: 409,
};

/** Every /api/admin/collections/* route handler's catch block goes through this. */
export function collectionErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof CollectionError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
