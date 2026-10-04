// tests/unit/support-assistant-route.test.ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

import { prisma } from "@/lib/db";
import { resetRateLimit } from "@/lib/rate-limit";
import { setSupportAssistantProvidersForTesting } from "@/services/support-assistant.service";
import type { EmbeddingProvider } from "@/services/embedding/embedding-provider.interface";
import type { ChatCompletionProvider } from "@/services/chat/chat-completion-provider.interface";

// STORY-071: see products-route.test.ts's comment.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const { auth } = await import("@/lib/auth");
const { POST: postMessage } = await import("@/app/api/ai/support-assistant/message/route");
const { GET } = await import("@/app/api/ai/support-assistant/conversations/[id]/route");
const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

function sessionFor(userId: string) {
  return { user: { id: userId }, expires: new Date(Date.now() + 60_000).toISOString() };
}

function fakeEmbeddingProvider(): EmbeddingProvider {
  return { name: "fake", generateEmbedding: async () => ({ embedding: Array.from({ length: 1536 }, () => 0), tokensUsed: 1 }) };
}

function throwingChatProvider(): ChatCompletionProvider {
  return { name: "fake", generateResponse: async () => { throw new Error("simulated provider failure"); } };
}

let userA: string;
let userB: string;

beforeEach(async () => {
  // Logged-in users — avoids getOrCreateSessionId()/getSessionId()'s cookies() call outside a
  // real request scope (same reasoning as smart-search-route.test.ts/recipe-assistant-route.test.ts).
  const a = await prisma.user.create({ data: { email: `support-assistant-route-a-${Date.now()}@test.test` } });
  const b = await prisma.user.create({ data: { email: `support-assistant-route-b-${Date.now()}@test.test` } });
  userA = a.id;
  userB = b.id;
  setSupportAssistantProvidersForTesting({ embedding: fakeEmbeddingProvider(), chat: throwingChatProvider(), moderation: async () => false });
});

afterEach(async () => {
  resetRateLimit(`support-assistant:${userA}`);
  await prisma.supportAssistantMessage.deleteMany();
  await prisma.supportAssistantConversation.deleteMany();
  await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  vi.clearAllMocks();
});

describe("POST /api/ai/support-assistant/message", () => {
  it("returns the fallback-shaped response for a valid message (no OpenAI credits in this environment)", async () => {
    mockAuth.mockResolvedValue(sessionFor(userA));
    const response = await postMessage(
      new Request("http://localhost/api/ai/support-assistant/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: null, message: "What's the status of my order?" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("conversationId");
    expect(body.referencedOrders).toEqual([]);
  });

  it("rejects an empty message", async () => {
    mockAuth.mockResolvedValue(sessionFor(userA));
    const response = await postMessage(
      new Request("http://localhost/api/ai/support-assistant/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: null, message: "" }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects a burst of requests past the configured rate limit with 429", async () => {
    mockAuth.mockResolvedValue(sessionFor(userA));
    let lastResponse: Response | undefined;
    for (let i = 0; i < 16; i++) {
      lastResponse = await postMessage(
        new Request("http://localhost/api/ai/support-assistant/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: null, message: `message ${i}` }),
        }),
      );
    }
    expect(lastResponse?.status).toBe(429);
  });
});

describe("GET /api/ai/support-assistant/conversations/[id] — auth scoping", () => {
  it("never lets one logged-in customer read another's conversation", async () => {
    const conversation = await prisma.supportAssistantConversation.create({ data: { customerId: userA } });
    await prisma.supportAssistantMessage.create({ data: { conversationId: conversation.id, role: "User", content: "hello" } });

    mockAuth.mockResolvedValue(sessionFor(userB));
    const asIntruder = await GET(new Request(`http://localhost/api/ai/support-assistant/conversations/${conversation.id}`), { params: Promise.resolve({ id: conversation.id }) });
    expect(asIntruder.status).toBe(404);

    mockAuth.mockResolvedValue(sessionFor(userA));
    const asOwner = await GET(new Request(`http://localhost/api/ai/support-assistant/conversations/${conversation.id}`), { params: Promise.resolve({ id: conversation.id }) });
    expect(asOwner.status).toBe(200);
  });
});
