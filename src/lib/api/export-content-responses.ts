import { NextResponse } from "next/server";

import { ExportContentError, type ExportContentErrorCode } from "@/services/export-content.errors";
import { PermissionDeniedError } from "@/services/permission.errors";
import { serverErrorResponse } from "@/lib/api/responses";

const statusByCode: Record<ExportContentErrorCode, number> = {
  solution_card_not_found: 404,
  process_step_not_found: 404,
  certification_strip_item_not_found: 404,
};

/** Every /api/admin/export/{solution-cards,process-steps}/* route handler's catch block goes through this. */
export function exportContentErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof ExportContentError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
