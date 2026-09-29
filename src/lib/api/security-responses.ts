import { NextResponse } from "next/server";

import { SecurityServiceError, type SecurityErrorCode } from "@/services/security.errors";

const statusByCode: Record<SecurityErrorCode, number> = {
  incorrect_current_password: 400,
};

export function securityErrorResponse(error: unknown) {
  if (error instanceof SecurityServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  throw error;
}
