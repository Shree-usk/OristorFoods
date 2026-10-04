import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getSessionId } from "@/lib/recommendation-session";
import { recipeAssistantErrorResponse } from "@/lib/api/recipe-assistant-responses";
import { getConversation } from "@/services/recipe-assistant.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const customerId = session?.user?.id ?? null;
  const sessionId = customerId ? null : await getSessionId();

  try {
    const messages = await getConversation(id, customerId, sessionId);
    return NextResponse.json({ messages });
  } catch (error) {
    return recipeAssistantErrorResponse(error, "GET /api/ai/recipe-assistant/conversations/[id]");
  }
}
