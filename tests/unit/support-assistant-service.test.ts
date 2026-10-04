// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { ChatCompletionMessage, ChatCompletionProvider } from "@/services/chat/chat-completion-provider.interface";
import type { EmbeddingProvider } from "@/services/embedding/embedding-provider.interface";
import { SupportAssistantConversationNotFoundError } from "@/services/support-assistant.errors";
import { getConversation, sendMessage, setSupportAssistantProvidersForTesting } from "@/services/support-assistant.service";

const EMAIL_DOMAIN = "@support-assistant-svc-test.test";
const ORDER_PREFIX = "SUPPORT-ASSISTANT-SVC-ORDER-";
let sequence = 0;
let capturedMessages: ChatCompletionMessage[] | null = null;

function fakeEmbeddingProvider(): EmbeddingProvider {
  return { name: "fake", generateEmbedding: async () => ({ embedding: Array.from({ length: 1536 }, () => 0), tokensUsed: 1 }) };
}

function fakeChatProvider(response: object): ChatCompletionProvider {
  return {
    name: "fake",
    generateResponse: async (messages) => {
      capturedMessages = messages;
      return { content: JSON.stringify(response), promptTokens: 10, completionTokens: 5 };
    },
  };
}

function throwingChatProvider(): ChatCompletionProvider {
  return { name: "fake", generateResponse: async () => { throw new Error("simulated provider failure"); } };
}

function defaultResponse(overrides: object = {}) {
  return { message: "Here you go.", referencedOrderNumbers: [], requiresSignIn: false, escalate: false, escalationReason: null, escalationCategory: null, confidenceScore: 0.9, ...overrides };
}

async function makeCustomer() {
  sequence += 1;
  return prisma.user.create({ data: { email: `customer-${sequence}${EMAIL_DOMAIN}` } });
}

async function makeOrder(userId: string) {
  sequence += 1;
  return prisma.order.create({
    data: {
      orderNumber: `ORS-20261004-${String(sequence).padStart(6, "0")}`,
      idempotencyKey: `idem-${ORDER_PREFIX}${sequence}`,
      userId,
      status: "Confirmed",
      subtotal: "100.00",
      deliveryCharge: "0.00",
      grandTotal: "100.00",
      deliveryZoneName: "Western",
      shipRecipientName: "Test Customer",
      shipPhone: "+94 77 123 4567",
      shipLine1: "10 Test Lane",
      shipCity: "Colombo",
    },
  });
}

afterEach(async () => {
  capturedMessages = null;
  setSupportAssistantProvidersForTesting({ embedding: fakeEmbeddingProvider(), chat: throwingChatProvider(), moderation: async () => false });
  await prisma.supportTicket.deleteMany({ where: { subject: { contains: "AI escalation" } } });
  await prisma.supportAssistantMessage.deleteMany();
  await prisma.supportAssistantConversation.deleteMany();
  await prisma.order.deleteMany({ where: { idempotencyKey: { startsWith: `idem-${ORDER_PREFIX}` } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
});

describe("support-assistant.service — guest order isolation", () => {
  it("never includes any order data in the prompt for a guest, even when the message names a real order number", async () => {
    const customer = await makeCustomer();
    const order = await makeOrder(customer.id);
    setSupportAssistantProvidersForTesting({ embedding: fakeEmbeddingProvider(), chat: fakeChatProvider(defaultResponse({ requiresSignIn: true })), moderation: async () => false });

    const result = await sendMessage({ conversationId: null, customerId: null, sessionId: "guest-session", message: `What's the status of order ${order.orderNumber}?` });

    expect(result.requiresSignIn).toBe(true);
    expect(result.referencedOrders).toEqual([]);
    const contextMessage = capturedMessages?.find((m) => m.role === "system" && m.content.startsWith("Context"));
    expect(contextMessage?.content).toContain('"isSignedIn":false');
    expect(contextMessage?.content).not.toContain(order.orderNumber);
  });
});

describe("support-assistant.service — cross-customer isolation", () => {
  it("never includes another customer's order in the context, even when a crafted message names it by number", async () => {
    const victim = await makeCustomer();
    const victimOrder = await makeOrder(victim.id);
    const attacker = await makeCustomer();
    setSupportAssistantProvidersForTesting({ embedding: fakeEmbeddingProvider(), chat: fakeChatProvider(defaultResponse()), moderation: async () => false });

    const result = await sendMessage({ conversationId: null, customerId: attacker.id, sessionId: null, message: `What's the status of order ${victimOrder.orderNumber}?` });

    expect(result.referencedOrders).toEqual([]);
    const contextMessage = capturedMessages?.find((m) => m.role === "system" && m.content.startsWith("Context"));
    expect(contextMessage?.content).not.toContain(victimOrder.orderNumber);
  });

  it("includes a customer's own order in the context when they ask about it", async () => {
    const customer = await makeCustomer();
    const order = await makeOrder(customer.id);
    setSupportAssistantProvidersForTesting({ embedding: fakeEmbeddingProvider(), chat: fakeChatProvider(defaultResponse({ referencedOrderNumbers: [order.orderNumber] })), moderation: async () => false });

    const result = await sendMessage({ conversationId: null, customerId: customer.id, sessionId: null, message: `What's the status of order ${order.orderNumber}?` });

    expect(result.referencedOrders.map((o) => o.orderNumber)).toEqual([order.orderNumber]);
    const contextMessage = capturedMessages?.find((m) => m.role === "system" && m.content.startsWith("Context"));
    expect(contextMessage?.content).toContain(order.orderNumber);
  });
});

describe("support-assistant.service — guardrail", () => {
  it("strips a referenced order number the provider invented outside the real set", async () => {
    const customer = await makeCustomer();
    const order = await makeOrder(customer.id);
    setSupportAssistantProvidersForTesting({
      embedding: fakeEmbeddingProvider(),
      chat: fakeChatProvider(defaultResponse({ referencedOrderNumbers: [order.orderNumber, "ORS-99999999-ZZZZZZ"] })),
      moderation: async () => false,
    });

    const result = await sendMessage({ conversationId: null, customerId: customer.id, sessionId: null, message: "order status" });

    expect(result.referencedOrders.map((o) => o.orderNumber)).toEqual([order.orderNumber]);
  });
});

describe("support-assistant.service — escalation", () => {
  it("creates a real SupportTicket with source AiAssistant and marks the conversation escalated", async () => {
    const customer = await makeCustomer();
    setSupportAssistantProvidersForTesting({
      embedding: fakeEmbeddingProvider(),
      chat: fakeChatProvider(defaultResponse({ escalate: true, escalationReason: "customer is upset", escalationCategory: "OrderIssue" })),
      moderation: async () => false,
    });

    const result = await sendMessage({ conversationId: null, customerId: customer.id, sessionId: null, message: "I need help" });

    expect(result.escalated).toBe(true);
    expect(result.ticketId).not.toBeNull();
    const ticket = await prisma.supportTicket.findUnique({ where: { id: result.ticketId! } });
    expect(ticket?.source).toBe("AiAssistant");
    expect(ticket?.category).toBe("OrderIssue");
    const conversation = await prisma.supportAssistantConversation.findUnique({ where: { id: result.conversationId } });
    expect(conversation?.escalated).toBe(true);
  });

  it("asks a guest to sign in instead of escalating, since guest tickets aren't supported", async () => {
    setSupportAssistantProvidersForTesting({
      embedding: fakeEmbeddingProvider(),
      chat: fakeChatProvider(defaultResponse({ escalate: true, escalationReason: "needs a human" })),
      moderation: async () => false,
    });

    const result = await sendMessage({ conversationId: null, customerId: null, sessionId: "guest-session-escalate", message: "I need a human" });

    expect(result.escalated).toBe(false);
    expect(result.ticketId).toBeNull();
    expect(result.message.toLowerCase()).toContain("sign in");
  });
});

describe("support-assistant.service — moderation short-circuit", () => {
  it("declines without calling the chat provider when the message is flagged", async () => {
    let chatProviderCalled = false;
    setSupportAssistantProvidersForTesting({
      embedding: fakeEmbeddingProvider(),
      chat: { name: "fake", generateResponse: async () => { chatProviderCalled = true; throw new Error("should not be called"); } },
      moderation: async () => true,
    });

    const result = await sendMessage({ conversationId: null, customerId: null, sessionId: "guest-session-flagged", message: "anything" });

    expect(chatProviderCalled).toBe(false);
    expect(result.escalated).toBe(false);
  });
});

describe("support-assistant.service — graceful fallback on provider failure", () => {
  it("returns a fallback message instead of throwing when the chat provider fails", async () => {
    setSupportAssistantProvidersForTesting({ embedding: fakeEmbeddingProvider(), chat: throwingChatProvider(), moderation: async () => false });

    const result = await sendMessage({ conversationId: null, customerId: null, sessionId: "guest-session-fail", message: "anything" });

    expect(result.message.toLowerCase()).toContain("trouble");
  });
});

describe("support-assistant.service — strict conversation ownership", () => {
  it("rejects a sessionId-only match against a conversation that already has a customerId (defense in depth)", async () => {
    const customer = await makeCustomer();
    setSupportAssistantProvidersForTesting({ embedding: fakeEmbeddingProvider(), chat: throwingChatProvider(), moderation: async () => false });
    const result = await sendMessage({ conversationId: null, customerId: customer.id, sessionId: null, message: "hello" });

    await expect(getConversation(result.conversationId, null, "some-anonymous-session")).rejects.toBeInstanceOf(SupportAssistantConversationNotFoundError);
    await expect(getConversation(result.conversationId, customer.id, null)).resolves.not.toBeNull();
  });

  it("rejects a different customer's id against an existing conversation", async () => {
    const owner = await makeCustomer();
    const intruder = await makeCustomer();
    setSupportAssistantProvidersForTesting({ embedding: fakeEmbeddingProvider(), chat: throwingChatProvider(), moderation: async () => false });
    const result = await sendMessage({ conversationId: null, customerId: owner.id, sessionId: null, message: "hello" });

    await expect(sendMessage({ conversationId: result.conversationId, customerId: intruder.id, sessionId: null, message: "hi" })).rejects.toBeInstanceOf(
      SupportAssistantConversationNotFoundError,
    );
  });
});
