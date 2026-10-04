import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getOrCreateSessionId } from "@/lib/recommendation-session";
import { supportAssistantErrorResponse } from "@/lib/api/support-assistant-responses";
import { validationErrorResponse } from "@/lib/api/responses";
import { escalateConversation } from "@/services/support-assistant.service";
import { escalateSupportAssistantSchema } from "@/validation/support-assistant.schema";

/** STORY-063. The widget's explicit "Talk to a human" button — doesn't wait for the model to decide. */
const ESCALATE_RATE_LIMIT = { max: 5, windowMs: 60 * 1000 };

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = escalateSupportAssistantSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const session = await auth();
  const customerId = session?.user?.id ?? null;
  const sessionId = customerId ? null : await getOrCreateSessionId();

  const rateLimitKey = customerId ? `support-assistant-escalate:${customerId}` : `support-assistant-escalate:${sessionId ?? "anonymous"}`;
  if (!checkRateLimit(rateLimitKey, ESCALATE_RATE_LIMIT)) {
    return NextResponse.json({ error: "Please wait a moment before trying again." }, { status: 429 });
  }

  try {
    const result = await escalateConversation(parsed.data.conversationId, customerId, sessionId);
    return NextResponse.json(result);
  } catch (error) {
    return supportAssistantErrorResponse(error, "POST /api/ai/support-assistant/escalate");
  }
}
