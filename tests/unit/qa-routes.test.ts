// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { registerQaNotifier, resetQaNotifierForTesting } from "@/services/qa-notifications";
import { answerQuestion, changeQuestionStatus, submitQuestion } from "@/services/qa.service";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const { auth } = await import("@/lib/auth");
const listRoute = await import("@/app/api/products/[slug]/questions/route");
const mineRoute = await import("@/app/api/products/[slug]/questions/mine/route");
const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

let sequence = 0;

function sessionFor(userId: string): Session {
  return { user: { id: userId, name: null, email: null, image: null }, expires: "2099-01-01T00:00:00.000Z" };
}

function slugParams(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

function postRequest(body: unknown) {
  return new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}

async function makeProduct(status: "Published" | "Draft" = "Published") {
  sequence += 1;
  return createProduct({ sku: `QA-ROUTE-${sequence}`, slug: `qa-route-${sequence}`, name: "Cinnamon", status });
}

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `qa-route-${sequence}@test.com` } });
}

beforeEach(() => {
  registerQaNotifier({ onQuestionSubmitted: async () => {}, onQuestionPublished: async () => {} });
});

afterEach(async () => {
  resetQaNotifierForTesting();
  vi.clearAllMocks();
  await prisma.question.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
});

describe("GET /api/products/[slug]/questions", () => {
  it("lists Published Q&A only and applies q", async () => {
    const product = await makeProduct();
    const published = await submitQuestion((await makeUser()).id, product.slug, { text: "How should I store it?" });
    await answerQuestion(published.id, "Airtight jar.");
    await changeQuestionStatus(published.id, "Approved");
    await changeQuestionStatus(published.id, "Published");
    await submitQuestion((await makeUser()).id, product.slug, { text: "A pending question here?" });

    const all = await listRoute.GET(new Request(`http://localhost/api/products/${product.slug}/questions`), slugParams(product.slug));
    const filtered = await listRoute.GET(
      new Request(`http://localhost/api/products/${product.slug}/questions?q=nothing-matches`),
      slugParams(product.slug),
    );

    expect(all.status).toBe(200);
    expect(await all.json()).toMatchObject({ total: 1, page: 1, pageSize: 10, items: [{ id: published.id }] });
    expect((await filtered.json()).total).toBe(0);
  });

  it("returns 400 with field errors for an invalid query, 404 for an unpublished product", async () => {
    const product = await makeProduct();
    const draft = await makeProduct("Draft");

    const invalid = await listRoute.GET(new Request(`http://localhost/x?pageSize=99`), slugParams(product.slug));
    const missing = await listRoute.GET(new Request("http://localhost/x"), slugParams(draft.slug));

    expect(invalid.status).toBe(400);
    expect((await invalid.json()).fieldErrors.pageSize).toBeDefined();
    expect(missing.status).toBe(404);
  });
});

describe("POST /api/products/[slug]/questions", () => {
  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const product = await makeProduct();

    expect((await listRoute.POST(postRequest({ text: "Is it organic?" }), slugParams(product.slug))).status).toBe(401);
  });

  it("returns 400 with field errors, 404 for an unknown product, 201 on success", async () => {
    const product = await makeProduct();
    mockAuth.mockResolvedValue(sessionFor((await makeUser()).id));

    const invalid = await listRoute.POST(postRequest({ text: "Hot?" }), slugParams(product.slug));
    const missing = await listRoute.POST(postRequest({ text: "Is it organic?" }), slugParams("nope"));
    const created = await listRoute.POST(postRequest({ text: "Is it organic?" }), slugParams(product.slug));

    expect(invalid.status).toBe(400);
    expect((await invalid.json()).fieldErrors.text).toEqual(["Question must be at least 10 characters"]);
    expect(missing.status).toBe(404);
    expect(created.status).toBe(201);
    expect((await created.json()).question).toMatchObject({ text: "Is it organic?", status: "Pending" });
  });
});

describe("GET /api/products/[slug]/questions/mine", () => {
  it("returns 401, 404 for an unknown product, then the customer's open questions", async () => {
    const product = await makeProduct();
    const user = await makeUser();

    mockAuth.mockResolvedValue(null);
    expect((await mineRoute.GET(new Request("http://localhost/x"), slugParams(product.slug))).status).toBe(401);

    mockAuth.mockResolvedValue(sessionFor(user.id));
    expect((await mineRoute.GET(new Request("http://localhost/x"), slugParams("nope"))).status).toBe(404);

    const question = await submitQuestion(user.id, product.slug, { text: "My question is this?" });
    const response = await mineRoute.GET(new Request("http://localhost/x"), slugParams(product.slug));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ questions: [question] });
  });
});
