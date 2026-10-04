import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getOrCreateSessionId } from "@/lib/recommendation-session";
import { recipeAssistantErrorResponse } from "@/lib/api/recipe-assistant-responses";
import { validationErrorResponse } from "@/lib/api/responses";
import { sendMessage } from "@/services/recipe-assistant.service";
import { sendRecipeAssistantMessageSchema } from "@/validation/recipe-assistant.schema";

/**
 * STORY-062. Rate-limited like GET /api/search (STORY-061) — every
 * call is a real paid OpenAI request. Keyed by customer id, else the
 * anonymous rec_sid session, else IP.
 */
const MESSAGE_RATE_LIMIT = { max: 15, windowMs: 60 * 1000 };

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = sendRecipeAssistantMessageSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const session = await auth();
  const customerId = session?.user?.id ?? null;
  const sessionId = customerId ? null : await getOrCreateSessionId();

  const rateLimitKey = customerId
    ? `recipe-assistant:${customerId}`
    : `recipe-assistant:${sessionId ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous"}`;
  if (!checkRateLimit(rateLimitKey, MESSAGE_RATE_LIMIT)) {
    return NextResponse.json({ error: "Too many messages. Please wait a moment before sending another." }, { status: 429 });
  }

  try {
    const result = await sendMessage({
      conversationId: parsed.data.conversationId ?? null,
      customerId,
      sessionId,
      message: parsed.data.message,
      filters: parsed.data.filters,
    });
    return NextResponse.json(result);
  } catch (error) {
    return recipeAssistantErrorResponse(error, "POST /api/ai/recipe-assistant/message");
  }
}
