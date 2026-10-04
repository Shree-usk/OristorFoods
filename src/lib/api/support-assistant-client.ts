/** STORY-063. Fetch wrappers for /api/ai/support-assistant/*. */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export interface SupportAssistantOrderRef {
  orderNumber: string;
  status: string;
}

export interface SendSupportAssistantMessageResult {
  conversationId: string;
  message: string;
  referencedOrders: SupportAssistantOrderRef[];
  requiresSignIn: boolean;
  escalated: boolean;
  ticketId: string | null;
}

export async function sendSupportAssistantMessage(conversationId: string | null, message: string): Promise<SendSupportAssistantMessageResult> {
  const response = await fetch("/api/ai/support-assistant/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, message }),
  });
  await assertOkWithServerMessage(response, "Failed to send your message. Please try again.");
  return response.json();
}

export interface EscalateSupportAssistantResult {
  ticketId: string | null;
  message: string;
}

export async function escalateSupportAssistant(conversationId: string): Promise<EscalateSupportAssistantResult> {
  const response = await fetch("/api/ai/support-assistant/escalate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId }),
  });
  await assertOkWithServerMessage(response, "Failed to connect you with a human agent. Please try again.");
  return response.json();
}

export interface SupportAssistantMessageRow {
  id: string;
  role: "User" | "Assistant";
  content: string;
  createdAt: string;
}

export async function fetchSupportAssistantConversation(conversationId: string): Promise<SupportAssistantMessageRow[]> {
  const response = await fetch(`/api/ai/support-assistant/conversations/${conversationId}`);
  if (response.status === 404) return [];
  await assertOkWithServerMessage(response, "Failed to load the conversation.");
  const body: { messages: SupportAssistantMessageRow[] } = await response.json();
  return body.messages;
}
