import * as supportAssistantRepository from "@/repositories/support-assistant.repository";
import * as productRepository from "@/repositories/product.repository";
import * as searchRepository from "@/repositories/search.repository";
import * as embeddingRepository from "@/repositories/embedding.repository";
import { OpenAiEmbeddingProvider } from "@/services/embedding/openai-embedding.provider";
import type { EmbeddingProvider } from "@/services/embedding/embedding-provider.interface";
import { OpenAiChatProvider } from "@/services/chat/openai-chat.provider";
import type { ChatCompletionMessage, ChatCompletionProvider } from "@/services/chat/chat-completion-provider.interface";
import { isFlaggedByModeration as defaultIsFlaggedByModeration } from "@/services/chat/openai-moderation";
import { getPolicyDocumentBySlug } from "@/services/policy-document.service";
import * as orderService from "@/services/order.service";
import { OrderForbiddenError, OrderNotFoundError } from "@/services/order.errors";
import { createTicket } from "@/services/support-ticket.service";
import { SupportAssistantConversationNotFoundError } from "@/services/support-assistant.errors";
import type { SupportTicketCategory } from "@/generated/prisma/client";

/**
 * STORY-063. Orchestrates the Support Assistant's retrieve -> ground
 * -> generate -> validate flow. The security guarantee comes from
 * controlling the LLM's INPUT, not filtering its output: a guest's
 * prompt never contains any order data at all, and an authenticated
 * customer's prompt only ever contains THAT customer's own orders
 * (fetched through the already ownership-scoped order.service.ts
 * functions). See docs/architecture-decisions.md for the full
 * reasoning. No token streaming — incompatible with "never fabricate
 * order numbers, tracking, refund amounts."
 */

const HISTORY_LIMIT = 10;
const ORDER_LIMIT = 5;
const PRODUCT_CANDIDATE_LIMIT = 5;
const POLICY_SLUG = "returns-refunds-exchanges";
const ORDER_NUMBER_PATTERN = /ORS-\d{8}-[0-9A-Z]{6}/gi;

const FALLBACK_MESSAGE = "I'm having trouble right now — please visit Order History & Support, or contact us directly, and we'll help you from there.";
const DECLINE_MESSAGE = "I can't help with that — I'm here for order status, product questions, and our returns/refund policy.";
const SIGN_IN_MESSAGE = "I'd need you to sign in to look up your order details — please sign in and ask again.";
const GUEST_ESCALATION_MESSAGE = "I'd need you to sign in to connect you with a human agent — please sign in and ask again, or reach us directly through our contact page.";

let embeddingProvider: EmbeddingProvider = new OpenAiEmbeddingProvider();
let chatProvider: ChatCompletionProvider = new OpenAiChatProvider();
let isFlaggedByModeration: (text: string) => Promise<boolean> = defaultIsFlaggedByModeration;

/** Test-only seams — mirror recipe-assistant.service.ts's own pattern. */
export function setSupportAssistantProvidersForTesting(providers: {
  embedding?: EmbeddingProvider;
  chat?: ChatCompletionProvider;
  moderation?: (text: string) => Promise<boolean>;
}) {
  if (providers.embedding) embeddingProvider = providers.embedding;
  if (providers.chat) chatProvider = providers.chat;
  if (providers.moderation) isFlaggedByModeration = providers.moderation;
}

const TICKET_CATEGORIES: readonly SupportTicketCategory[] = ["OrderIssue", "Product", "Delivery", "Billing", "Other"];

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    message: { type: "string" },
    referencedOrderNumbers: { type: "array", items: { type: "string" } },
    requiresSignIn: { type: "boolean" },
    escalate: { type: "boolean" },
    escalationReason: { type: ["string", "null"] },
    escalationCategory: { type: ["string", "null"], enum: [...TICKET_CATEGORIES, null] },
    confidenceScore: { type: "number" },
  },
  required: ["message", "referencedOrderNumbers", "requiresSignIn", "escalate", "escalationReason", "escalationCategory", "confidenceScore"],
  additionalProperties: false,
} as const;

interface StructuredResponse {
  message: string;
  referencedOrderNumbers: string[];
  requiresSignIn: boolean;
  escalate: boolean;
  escalationReason: string | null;
  escalationCategory: SupportTicketCategory | null;
  confidenceScore: number;
}

export interface SendMessageInput {
  conversationId: string | null;
  customerId: string | null;
  sessionId: string | null;
  message: string;
}

export interface SupportAssistantOrderRef {
  orderNumber: string;
  status: string;
}

export interface SendMessageResult {
  conversationId: string;
  message: string;
  referencedOrders: SupportAssistantOrderRef[];
  requiresSignIn: boolean;
  escalated: boolean;
  ticketId: string | null;
}

/**
 * Strict ownership check — once a conversation has a non-null
 * customerId, only an exact customerId match is ever accepted, never
 * an OR-fallback to a sessionId match. Defense-in-depth beyond the
 * route layer's own customerId/sessionId exclusivity invariant.
 */
async function resolveConversationId(input: SendMessageInput): Promise<string> {
  if (!input.conversationId) {
    const created = await supportAssistantRepository.createConversation(input.customerId, input.sessionId);
    return created.id;
  }
  const existing = await supportAssistantRepository.findConversationById(input.conversationId);
  if (!existing) throw new SupportAssistantConversationNotFoundError();
  if (existing.customerId !== null) {
    if (existing.customerId !== input.customerId) throw new SupportAssistantConversationNotFoundError();
  } else if (existing.sessionId === null || existing.sessionId !== input.sessionId) {
    throw new SupportAssistantConversationNotFoundError();
  }
  return existing.id;
}

interface OrderContext {
  orderNumber: string;
  status: string;
  grandTotal: number;
  currency: string;
  itemCount: number;
  createdAt: string;
}

/** Only ever called for an authenticated customerId — a guest's prompt never reaches here, so it never contains order data at all. */
async function fetchOrderContext(customerId: string, message: string): Promise<OrderContext[]> {
  const { orders } = await orderService.listOrdersForUser(customerId, 1, ORDER_LIMIT);
  const context = new Map<string, OrderContext>(orders.map((order) => [order.orderNumber, order]));

  const mentioned = [...new Set([...message.matchAll(ORDER_NUMBER_PATTERN)].map((match) => match[0].toUpperCase()))];
  for (const orderNumber of mentioned) {
    if (context.has(orderNumber)) continue;
    try {
      // Ownership-checked — throws OrderNotFoundError for a nonexistent OR non-owned order. Caught and silently
      // skipped either way: never confirm/deny "that order exists but isn't yours" (an enumeration oracle).
      const order = await orderService.getOrderForConfirmation(orderNumber, customerId, null);
      context.set(orderNumber, {
        orderNumber: order.orderNumber,
        status: order.status,
        grandTotal: order.grandTotal.toNumber(),
        currency: "LKR",
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        createdAt: order.createdAt.toISOString(),
      });
    } catch (error) {
      // Nonexistent (OrderNotFoundError) and non-owned (OrderForbiddenError) are both silently
      // skipped, the same way — never confirm/deny which one it was (an enumeration oracle).
      if (!(error instanceof OrderNotFoundError) && !(error instanceof OrderForbiddenError)) throw error;
    }
  }
  return [...context.values()];
}

async function fetchProductContext(message: string) {
  const keywordMatches = await searchRepository.findRankedProductMatches(message);
  const ids = keywordMatches.slice(0, PRODUCT_CANDIDATE_LIMIT).map((match) => match.productId);

  try {
    const { embedding } = await embeddingProvider.generateEmbedding(message);
    const semanticMatches = await embeddingRepository.findSimilarProductIds(embedding, PRODUCT_CANDIDATE_LIMIT);
    const seen = new Set(ids);
    for (const match of semanticMatches) {
      if (!seen.has(match.id)) {
        ids.push(match.id);
        seen.add(match.id);
      }
    }
  } catch {
    // Keyword-only is fine — same transparent-fallback standard as smart-search.service.ts.
  }

  if (ids.length === 0) return [];
  const products = await productRepository.findProductsForCompareByIds(ids.slice(0, PRODUCT_CANDIDATE_LIMIT));
  return products.map((product) => ({
    name: product.name,
    shortDescription: product.shortDescription,
    inStock: product.inStock,
    stockQuantity: product.stockQuantity,
    allergens: product.allergens.map((allergen) => allergen.name),
    ingredients: product.ingredients.map((ingredient) => ingredient.name),
  }));
}

const SYSTEM_PROMPT = `You are Oristor's Customer Support Assistant for Oristor Food Products, a Sri Lankan food brand.
You answer questions about order status, product questions (ingredients, allergens, stock), and our returns/refund/exchange policy.
You must ONLY state facts present in the context given to you in the next message — order numbers, statuses, amounts, product details, and policy text must come from that context, never invented.
If the customer asks about an order and no order data is in your context, set requiresSignIn to true and do not guess.
If you are not confident, the topic is sensitive (e.g. a dispute, a refund demand, a complaint), or the customer asks for a human, set escalate to true with a brief escalationReason and the best-fitting escalationCategory (OrderIssue, Product, Delivery, Billing, or Other).
Keep your message concise and friendly. Do not repeat the raw context data back verbatim — summarize naturally.`;

async function generateStructuredResponse(history: ChatCompletionMessage[], context: string, userMessage: string) {
  const messages: ChatCompletionMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `Context (JSON): ${context}` },
    ...history,
    { role: "user", content: userMessage },
  ];
  const result = await chatProvider.generateResponse(messages, { jsonSchema: RESPONSE_SCHEMA });
  const parsed = JSON.parse(result.content) as StructuredResponse;
  return { parsed, promptTokens: result.promptTokens, completionTokens: result.completionTokens };
}

function resolveTicketCategory(category: SupportTicketCategory | null): SupportTicketCategory {
  return category && TICKET_CATEGORIES.includes(category) ? category : "Other";
}

async function escalate(conversationId: string, customerId: string, category: SupportTicketCategory | null, reason: string | null, orderNumbers: string[], transcript: string): Promise<string> {
  const ticket = await createTicket(customerId, {
    category: resolveTicketCategory(category),
    subject: reason ? `AI escalation: ${reason}` : "AI escalation",
    message: transcript,
    orderNumber: orderNumbers[0],
    source: "AiAssistant",
    conversationId,
  });
  await supportAssistantRepository.markEscalated(conversationId);
  return ticket.id;
}

export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  const conversationId = await resolveConversationId(input);

  await supportAssistantRepository.createMessage({ conversationId, role: "User", content: input.message });

  if (await isFlaggedByModeration(input.message)) {
    await supportAssistantRepository.createMessage({ conversationId, role: "Assistant", content: DECLINE_MESSAGE });
    await supportAssistantRepository.touchConversation(conversationId);
    return { conversationId, message: DECLINE_MESSAGE, referencedOrders: [], requiresSignIn: false, escalated: false, ticketId: null };
  }

  try {
    const [orders, products, policy, recentMessages] = await Promise.all([
      input.customerId ? fetchOrderContext(input.customerId, input.message) : Promise.resolve<OrderContext[]>([]),
      fetchProductContext(input.message),
      getPolicyDocumentBySlug(POLICY_SLUG),
      supportAssistantRepository.findRecentMessages(conversationId, HISTORY_LIMIT),
    ]);

    const context = JSON.stringify({
      isSignedIn: input.customerId !== null,
      orders,
      products,
      returnsRefundsPolicy: policy?.content ?? null,
    });
    const history: ChatCompletionMessage[] = recentMessages
      .slice()
      .reverse()
      .map((row) => ({ role: row.role === "User" ? "user" : "assistant", content: row.content }));

    const { parsed, promptTokens, completionTokens } = await generateStructuredResponse(history, context, input.message);

    // Guardrail: only trust order numbers that were actually in this turn's real, ownership-scoped order data.
    const realOrderNumbers = new Set(orders.map((order) => order.orderNumber));
    const validOrderNumbers = parsed.referencedOrderNumbers.filter((orderNumber) => realOrderNumbers.has(orderNumber));
    const referencedOrders = orders.filter((order) => validOrderNumbers.includes(order.orderNumber)).map((order) => ({ orderNumber: order.orderNumber, status: order.status }));

    let ticketId: string | null = null;
    let escalated = false;
    let responseMessage = parsed.message;

    if (parsed.escalate) {
      if (input.customerId) {
        ticketId = await escalate(conversationId, input.customerId, parsed.escalationCategory, parsed.escalationReason, validOrderNumbers, `${parsed.message}\n\n(Customer's last message: ${input.message})`);
        escalated = true;
      } else {
        responseMessage = GUEST_ESCALATION_MESSAGE;
      }
    }

    await supportAssistantRepository.createMessage({
      conversationId,
      role: "Assistant",
      content: responseMessage,
      structuredPayload: { message: parsed.message, referencedOrderNumbers: validOrderNumbers, requiresSignIn: parsed.requiresSignIn, escalate: parsed.escalate, escalationReason: parsed.escalationReason },
      confidenceScore: parsed.confidenceScore,
      promptTokens,
      completionTokens,
    });
    await supportAssistantRepository.touchConversation(conversationId);

    return {
      conversationId,
      message: parsed.requiresSignIn ? SIGN_IN_MESSAGE : responseMessage,
      referencedOrders,
      requiresSignIn: parsed.requiresSignIn,
      escalated,
      ticketId,
    };
  } catch (error) {
    console.error("[support-assistant] failed to generate a response", error);
    await supportAssistantRepository.createMessage({ conversationId, role: "Assistant", content: FALLBACK_MESSAGE });
    await supportAssistantRepository.touchConversation(conversationId);
    return { conversationId, message: FALLBACK_MESSAGE, referencedOrders: [], requiresSignIn: false, escalated: false, ticketId: null };
  }
}

export async function escalateConversation(conversationId: string, customerId: string | null, sessionId: string | null): Promise<{ ticketId: string | null; message: string }> {
  const existing = await supportAssistantRepository.findConversationById(conversationId);
  const owns = existing && ((customerId && existing.customerId === customerId) || (sessionId && existing.sessionId === sessionId));
  if (!owns) throw new SupportAssistantConversationNotFoundError();

  if (!customerId) {
    return { ticketId: null, message: GUEST_ESCALATION_MESSAGE };
  }

  const messages = await supportAssistantRepository.findConversationMessages(conversationId);
  const transcript = messages.map((row) => `${row.role}: ${row.content}`).join("\n");
  const ticketId = await escalate(conversationId, customerId, null, "Customer requested a human agent", [], transcript || "Customer requested a human agent.");
  return { ticketId, message: "I've connected you with a human agent — you can follow up in Order History & Support." };
}

export async function getConversation(id: string, customerId: string | null, sessionId: string | null) {
  const conversation = await supportAssistantRepository.findConversationById(id);
  const owns = conversation && ((customerId && conversation.customerId === customerId) || (sessionId && conversation.sessionId === sessionId));
  if (!owns) throw new SupportAssistantConversationNotFoundError();
  return supportAssistantRepository.findConversationMessages(id);
}
