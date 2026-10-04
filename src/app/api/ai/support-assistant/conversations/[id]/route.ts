import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getSessionId } from "@/lib/recommendation-session";
import { supportAssistantErrorResponse } from "@/lib/api/support-assistant-responses";
import { getConversation } from "@/services/support-assistant.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const customerId = session?.user?.id ?? null;
  const sessionId = customerId ? null : await getSessionId();

  try {
    const messages = await getConversation(id, customerId, sessionId);
    return NextResponse.json({ messages });
  } catch (error) {
    return supportAssistantErrorResponse(error, "GET /api/ai/support-assistant/conversations/[id]");
  }
}
