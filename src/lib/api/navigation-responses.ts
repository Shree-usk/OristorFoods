import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { NavigationError, type NavigationErrorCode } from "@/services/navigation.errors";
import { PermissionDeniedError } from "@/services/permission.errors";

const statusByCode: Record<NavigationErrorCode, number> = {
  menu_not_found: 404,
  item_not_found: 404,
  no_archived_menu: 404,
  invalid_link_target: 400,
  max_depth_exceeded: 400,
  invalid_content_block: 400,
};

/** Every /api/admin/navigation/* route handler's catch block goes through this. */
export function navigationErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof NavigationError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
