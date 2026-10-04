// tests/unit/recipe-assistant-route.test.ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

import { prisma } from "@/lib/db";
import { resetRateLimit } from "@/lib/rate-limit";
import { setRecipeAssistantProvidersForTesting } from "@/services/recipe-assistant.service";
import type { EmbeddingProvider } from "@/services/embedding/embedding-provider.interface";
import type { ChatCompletionProvider } from "@/services/chat/chat-completion-provider.interface";

// STORY-071: see products-route.test.ts's comment.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const { auth } = await import("@/lib/auth");
const { POST } = await import("@/app/api/ai/recipe-assistant/message/route");
const { GET } = await import("@/app/api/ai/recipe-assistant/conversations/[id]/route");
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

let userId: string;

beforeEach(async () => {
  // A logged-in user — avoids getOrCreateSessionId()/getSessionId()'s
  // cookies() call, which can't run outside a real request scope (same
  // reasoning as smart-search-route.test.ts).
  const user = await prisma.user.create({ data: { email: `recipe-assistant-route-${Date.now()}@test.test` } });
  userId = user.id;
  mockAuth.mockResolvedValue(sessionFor(userId));
  setRecipeAssistantProvidersForTesting({ embedding: fakeEmbeddingProvider(), chat: throwingChatProvider(), moderation: async () => false });
});

afterEach(async () => {
  resetRateLimit(`recipe-assistant:${userId}`);
  await prisma.recipeAssistantMessage.deleteMany();
  await prisma.recipeAssistantConversation.deleteMany();
  await prisma.user.deleteMany({ where: { id: userId } });
  vi.clearAllMocks();
});

describe("POST /api/ai/recipe-assistant/message", () => {
  it("returns the fallback-shaped response for a valid message (no OpenAI credits in this environment)", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/recipe-assistant/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: null, message: "I have chicken and rice", filters: { dietaryTagSlugs: [], categorySlug: null } }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("conversationId");
    expect(body).toHaveProperty("message");
    expect(body.recipes).toEqual([]);
  });

  it("rejects an empty message", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/recipe-assistant/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: null, message: "", filters: {} }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects a burst of requests past the configured rate limit with 429", async () => {
    let lastResponse: Response | undefined;
    for (let i = 0; i < 16; i++) {
      lastResponse = await POST(
        new Request("http://localhost/api/ai/recipe-assistant/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: null, message: `message ${i}`, filters: {} }),
        }),
      );
    }
    expect(lastResponse?.status).toBe(429);
  });
});

describe("GET /api/ai/recipe-assistant/conversations/[id]", () => {
  it("returns 404 for a conversation the current user doesn't own", async () => {
    const otherUser = await prisma.user.create({ data: { email: `recipe-assistant-route-other-${Date.now()}@test.test` } });
    const conversation = await prisma.recipeAssistantConversation.create({ data: { customerId: otherUser.id } });

    const response = await GET(new Request(`http://localhost/api/ai/recipe-assistant/conversations/${conversation.id}`), { params: Promise.resolve({ id: conversation.id }) });

    expect(response.status).toBe(404);
    await prisma.recipeAssistantConversation.deleteMany({ where: { id: conversation.id } });
    await prisma.user.deleteMany({ where: { id: otherUser.id } });
  });

  it("returns the conversation's messages for the owning customer", async () => {
    const conversation = await prisma.recipeAssistantConversation.create({ data: { customerId: userId } });
    await prisma.recipeAssistantMessage.create({ data: { conversationId: conversation.id, role: "User", content: "hello" } });

    const response = await GET(new Request(`http://localhost/api/ai/recipe-assistant/conversations/${conversation.id}`), { params: Promise.resolve({ id: conversation.id }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.messages).toHaveLength(1);
  });
});
