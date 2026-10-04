// tests/unit/smart-search-route.test.ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { resetRateLimit } from "@/lib/rate-limit";
import { setSmartSearchEmbeddingProviderForTesting } from "@/services/smart-search.service";

// STORY-071: see products-route.test.ts's comment.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const { auth } = await import("@/lib/auth");
const { GET } = await import("@/app/api/search/route");
const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

function sessionFor(userId: string) {
  return { user: { id: userId }, expires: new Date(Date.now() + 60_000).toISOString() };
}

const SKU_PREFIX = "SMART-SEARCH-ROUTE-SKU-";
let userId: string;

beforeEach(async () => {
  // A logged-in user — the rate-limit key and getSmartSearchResults's
  // sessionId branch both skip the cookies()-backed anonymous path
  // (getOrCreateSessionId), which cookies() can't support outside a
  // real request scope; the anonymous path is covered by the e2e spec
  // instead, which runs through a real server.
  const user = await prisma.user.create({ data: { email: `smart-search-route-${Date.now()}@test.test` } });
  userId = user.id;
  mockAuth.mockResolvedValue(sessionFor(userId));
  // Avoid 20 real OpenAI round-trips per test run — the semantic layer's
  // own behavior is covered by smart-search-service.test.ts; this file
  // tests the route's own concerns (shape, auth, rate limiting).
  setSmartSearchEmbeddingProviderForTesting({ name: "fake", generateEmbedding: async () => { throw new Error("no credits"); } });
});

afterEach(async () => {
  resetRateLimit(`search:${userId}`);
  await prisma.searchQueryLog.deleteMany();
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.user.deleteMany({ where: { id: userId } });
  vi.clearAllMocks();
});

describe("GET /api/search", () => {
  it("returns the grouped smart-search shape for a matching query", async () => {
    const product = await createProduct({ sku: `${SKU_PREFIX}1`, slug: "smart-search-route-curry", name: "Smart Search Route Curry Powder", status: "Published" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "450.00" });

    const response = await GET(new Request("http://localhost/api/search?q=Smart+Search+Route+Curry"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.products.map((p: { name: string }) => p.name)).toContain("Smart Search Route Curry Powder");
    expect(body).toHaveProperty("recipes");
    expect(body).toHaveProperty("blogPosts");
    expect(body).toHaveProperty("foodAcademyEntries");
  });

  it("rejects a burst of requests past the configured rate limit with 429", async () => {
    let lastResponse: Response | undefined;
    for (let i = 0; i < 25; i++) {
      lastResponse = await GET(new Request(`http://localhost/api/search?q=anything-${i}`));
    }

    expect(lastResponse?.status).toBe(429);
  });
});
