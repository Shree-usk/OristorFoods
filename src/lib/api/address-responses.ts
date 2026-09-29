import { NextResponse } from "next/server";

import { AddressServiceError, type AddressErrorCode } from "@/services/address.errors";

const statusByCode: Record<AddressErrorCode, number> = {
  not_found: 404,
  forbidden: 403,
  limit_exceeded: 409,
};

export function addressErrorResponse(error: unknown) {
  if (error instanceof AddressServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: statusByCode[error.code] });
  }
  throw error;
}
