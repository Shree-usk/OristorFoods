import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { RecipeAssistantError, type RecipeAssistantErrorCode } from "@/services/recipe-assistant.errors";

const recipeAssistantStatusByCode: Record<RecipeAssistantErrorCode, number> = {
  conversation_not_found: 404,
};

export function recipeAssistantErrorResponse(error: unknown, context: string) {
  if (error instanceof RecipeAssistantError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: recipeAssistantStatusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
