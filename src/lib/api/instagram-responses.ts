import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { InstagramError, type InstagramErrorCode } from "@/services/instagram.errors";
import { PermissionDeniedError } from "@/services/permission.errors";

const statusByCode: Record<InstagramErrorCode, number> = {
  instagram_not_connected: 409,
  instagram_connect_failed: 422,
  instagram_sync_failed: 502,
};

/** Every /api/admin/settings/integrations/instagram/* route handler's catch block goes through this. */
export function instagramErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof InstagramError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
