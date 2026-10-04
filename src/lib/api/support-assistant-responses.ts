import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { SupportAssistantError, type SupportAssistantErrorCode } from "@/services/support-assistant.errors";

const supportAssistantStatusByCode: Record<SupportAssistantErrorCode, number> = {
  conversation_not_found: 404,
};

export function supportAssistantErrorResponse(error: unknown, context: string) {
  if (error instanceof SupportAssistantError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: supportAssistantStatusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
