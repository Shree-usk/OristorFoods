// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { changeReviewStatus, submitReview } from "@/services/review.service";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const { auth } = await import("@/lib/auth");
const listRoute = await import("@/app/api/products/[slug]/reviews/route");
const mineRoute = await import("@/app/api/products/[slug]/reviews/mine/route");
const itemRoute = await import("@/app/api/products/[slug]/reviews/[reviewId]/route");
const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

const input = { rating: 5, title: "Superb", body: "Fragrant, fresh and perfectly ground." };
let sequence = 0;

function sessionFor(userId: string): Session {
  return { user: { id: userId, name: null, email: null, image: null }, expires: "2099-01-01T00:00:00.000Z" };
}

function slugParams(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

function reviewParams(slug: string, reviewId: string) {
  return { params: Promise.resolve({ slug, reviewId }) };
}

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}

async function makeProduct(status: "Published" | "Draft" = "Published") {
  sequence += 1;
  return createProduct({ sku: `REV-ROUTE-${sequence}`, slug: `rev-route-${sequence}`, name: "Turmeric", status });
}

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `rev-route-${sequence}@test.com`, name: "Route Tester" } });
}

afterEach(async () => {
  await prisma.productRatingSummary.deleteMany();
  await prisma.review.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  vi.clearAllMocks();
});

describe("GET /api/products/[slug]/reviews", () => {
  it("lists Published reviews only", async () => {
    const product = await makeProduct();
    const published = await submitReview((await makeUser()).id, product.slug, input);
    await changeReviewStatus(published.id, "Approved");
    await changeReviewStatus(published.id, "Published");
    await submitReview((await makeUser()).id, product.slug, input); // Pending

    const response = await listRoute.GET(new Request(`http://localhost/api/products/${product.slug}/reviews`), slugParams(product.slug));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(body.items[0].id).toBe(published.id);
  });

  it("returns 400 with field errors for an invalid query", async () => {
    const product = await makeProduct();

    const response = await listRoute.GET(
      new Request(`http://localhost/api/products/${product.slug}/reviews?pageSize=99`),
      slugParams(product.slug),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors.pageSize).toBeDefined();
  });

  it("returns 404 for an unpublished product", async () => {
    const draft = await makeProduct("Draft");

    const response = await listRoute.GET(new Request(`http://localhost/api/products/${draft.slug}/reviews`), slugParams(draft.slug));

    expect(response.status).toBe(404);
  });
});

describe("POST /api/products/[slug]/reviews", () => {
  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const product = await makeProduct();

    const response = await listRoute.POST(jsonRequest("http://localhost/x", "POST", input), slugParams(product.slug));

    expect(response.status).toBe(401);
  });

  it("returns 400 with field errors for invalid input", async () => {
    const product = await makeProduct();
    mockAuth.mockResolvedValue(sessionFor((await makeUser()).id));

    const response = await listRoute.POST(jsonRequest("http://localhost/x", "POST", { ...input, body: "short" }), slugParams(product.slug));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors.body).toEqual(["Review must be at least 20 characters"]);
  });

  it("creates a Pending review (201), then 409 on a second attempt", async () => {
    const product = await makeProduct();
    mockAuth.mockResolvedValue(sessionFor((await makeUser()).id));

    const first = await listRoute.POST(jsonRequest("http://localhost/x", "POST", input), slugParams(product.slug));
    const second = await listRoute.POST(jsonRequest("http://localhost/x", "POST", input), slugParams(product.slug));

    expect(first.status).toBe(201);
    expect((await first.json()).review.status).toBe("Pending");
    expect(second.status).toBe(409);
  });

  it("returns 404 for an unknown product", async () => {
    mockAuth.mockResolvedValue(sessionFor((await makeUser()).id));

    const response = await listRoute.POST(jsonRequest("http://localhost/x", "POST", input), slugParams("nope"));

    expect(response.status).toBe(404);
  });
});

describe("GET /api/products/[slug]/reviews/mine", () => {
  it("returns 401, then null, then the customer's review", async () => {
    const product = await makeProduct();
    const user = await makeUser();

    mockAuth.mockResolvedValue(null);
    expect((await mineRoute.GET(new Request("http://localhost/x"), slugParams(product.slug))).status).toBe(401);

    mockAuth.mockResolvedValue(sessionFor(user.id));
    expect(await (await mineRoute.GET(new Request("http://localhost/x"), slugParams(product.slug))).json()).toEqual({ review: null });

    const review = await submitReview(user.id, product.slug, input);
    expect(await (await mineRoute.GET(new Request("http://localhost/x"), slugParams(product.slug))).json()).toEqual({ review });
  });

  it("returns 404 for a non-existent product slug", async () => {
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await mineRoute.GET(new Request("http://localhost/x"), slugParams("nope"));
    expect(response.status).toBe(404);
  });
});

describe("PATCH and DELETE /api/products/[slug]/reviews/[reviewId]", () => {
  it("lets the owner edit a Pending review", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    const review = await submitReview(user.id, product.slug, input);
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await itemRoute.PATCH(
      jsonRequest("http://localhost/x", "PATCH", { ...input, rating: 3 }),
      reviewParams(product.slug, review.id),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).review.rating).toBe(3);
  });

  it("returns 400 for invalid edits, 403 for another customer, 409 once past Pending", async () => {
    const product = await makeProduct();
    const owner = await makeUser();
    const review = await submitReview(owner.id, product.slug, input);

    mockAuth.mockResolvedValue(sessionFor(owner.id));
    const invalid = await itemRoute.PATCH(jsonRequest("http://localhost/x", "PATCH", { ...input, rating: 9 }), reviewParams(product.slug, review.id));
    expect(invalid.status).toBe(400);

    mockAuth.mockResolvedValue(sessionFor((await makeUser()).id));
    const forbidden = await itemRoute.PATCH(jsonRequest("http://localhost/x", "PATCH", input), reviewParams(product.slug, review.id));
    expect(forbidden.status).toBe(403);

    await changeReviewStatus(review.id, "Approved");
    mockAuth.mockResolvedValue(sessionFor(owner.id));
    const conflict = await itemRoute.PATCH(jsonRequest("http://localhost/x", "PATCH", input), reviewParams(product.slug, review.id));
    expect(conflict.status).toBe(409);
  });

  it("withdraws with 204, and returns 401/403/409 in the matching cases", async () => {
    const product = await makeProduct();
    const owner = await makeUser();
    const review = await submitReview(owner.id, product.slug, input);
    const request = () => new Request("http://localhost/x", { method: "DELETE" });

    mockAuth.mockResolvedValue(null);
    expect((await itemRoute.DELETE(request(), reviewParams(product.slug, review.id))).status).toBe(401);

    mockAuth.mockResolvedValue(sessionFor((await makeUser()).id));
    expect((await itemRoute.DELETE(request(), reviewParams(product.slug, review.id))).status).toBe(403);

    mockAuth.mockResolvedValue(sessionFor(owner.id));
    const withdrawn = await itemRoute.DELETE(request(), reviewParams(product.slug, review.id));
    expect(withdrawn.status).toBe(204);
    expect(await prisma.review.findUnique({ where: { id: review.id } })).toBeNull();

    const again = await submitReview(owner.id, product.slug, input);
    await changeReviewStatus(again.id, "Approved");
    expect((await itemRoute.DELETE(request(), reviewParams(product.slug, again.id))).status).toBe(409);
  });

  it("returns 404 for PATCH with non-existent review ID", async () => {
    const product = await makeProduct();
    const owner = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(owner.id));

    const response = await itemRoute.PATCH(jsonRequest("http://localhost/x", "PATCH", input), reviewParams(product.slug, "missing-review-id"));
    expect(response.status).toBe(404);
  });

  it("returns 404 for DELETE with non-existent review ID", async () => {
    const product = await makeProduct();
    const owner = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(owner.id));
    const request = () => new Request("http://localhost/x", { method: "DELETE" });

    const response = await itemRoute.DELETE(request(), reviewParams(product.slug, "missing-review-id"));
    expect(response.status).toBe(404);
  });
});
