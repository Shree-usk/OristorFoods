import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getOrCreateSessionId } from "@/lib/recommendation-session";
import { supportAssistantErrorResponse } from "@/lib/api/support-assistant-responses";
import { validationErrorResponse } from "@/lib/api/responses";
import { sendMessage } from "@/services/support-assistant.service";
import { sendSupportAssistantMessageSchema } from "@/validation/support-assistant.schema";

/**
 * STORY-063. customerId comes only from auth(), never client input;
 * sessionId is set only when there is no customerId — this exclusivity
 * is the security invariant support-assistant.service.ts's ownership
 * check relies on. Rate-limited like 061/062's own AI endpoints —
 * every call is a real paid OpenAI request.
 */
const MESSAGE_RATE_LIMIT = { max: 15, windowMs: 60 * 1000 };

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = sendSupportAssistantMessageSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const session = await auth();
  const customerId = session?.user?.id ?? null;
  const sessionId = customerId ? null : await getOrCreateSessionId();

  const rateLimitKey = customerId
    ? `support-assistant:${customerId}`
    : `support-assistant:${sessionId ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous"}`;
  if (!checkRateLimit(rateLimitKey, MESSAGE_RATE_LIMIT)) {
    return NextResponse.json({ error: "Too many messages. Please wait a moment before sending another." }, { status: 429 });
  }

  try {
    const result = await sendMessage({
      conversationId: parsed.data.conversationId ?? null,
      customerId,
      sessionId,
      message: parsed.data.message,
    });
    return NextResponse.json(result);
  } catch (error) {
    return supportAssistantErrorResponse(error, "POST /api/ai/support-assistant/message");
  }
}
