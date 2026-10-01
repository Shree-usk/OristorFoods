import { NextResponse } from "next/server";

import { AuthServiceError, type AuthErrorCode } from "@/services/auth.errors";

const statusByCode: Record<AuthErrorCode, number> = {
  email_in_use: 409,
  invalid_reset_token: 400,
  reset_token_expired: 400,
  account_suspended: 403,
};

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  throw error;
}
