import { NextResponse } from "next/server";

import { DownloadServiceError, type DownloadErrorCode } from "@/services/download.errors";

const statusByCode: Record<DownloadErrorCode, number> = {
  not_found: 404,
  unauthorized: 401,
};

export function downloadErrorResponse(error: unknown) {
  if (error instanceof DownloadServiceError) {
    return NextResponse.json({ error: error.message }, { status: statusByCode[error.code] });
  }
  throw error;
}
