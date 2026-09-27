// tests/unit/recipe-review-routes.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

import { prisma } from "@/lib/db";
import { createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";
import { computeTotalTimeMinutes } from "@/lib/recipe-time";
import { advanceRecipeReviewToApproved, submitReview } from "@/services/recipe-review.service";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const { auth } = await import("@/lib/auth");
const listRoute = await import("@/app/api/recipes/[slug]/reviews/route");
const mineRoute = await import("@/app/api/recipes/[slug]/reviews/mine/route");
const itemRoute = await import("@/app/api/recipes/[slug]/reviews/[reviewId]/route");
const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

const input = { rating: 5, reviewText: "Fragrant and well-balanced." };
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

async function makeRecipe(status: "Published" | "Draft" = "Published") {
  sequence += 1;
  const category = await createRecipeCategory({ name: `Category ${sequence}`, slug: `rr-route-category-${sequence}` });
  return createRecipe({
    slug: `rr-route-recipe-${sequence}`,
    title: `Recipe ${sequence}`,
    shortDescription: "A test recipe.",
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: "Test hero image",
    categoryId: category.id,
    difficulty: "Easy",
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: computeTotalTimeMinutes(10, 20),
    servings: 4,
    status,
  });
}

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `rr-route-${sequence}@test.com`, name: "Route Tester" } });
}

afterEach(async () => {
  vi.clearAllMocks();
  await prisma.recipeReview.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.recipeCategory.deleteMany();
});

describe("POST /api/recipes/[slug]/reviews", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const recipe = await makeRecipe();

    const response = await listRoute.POST(jsonRequest("http://test/x", "POST", input), slugParams(recipe.slug));
    expect(response.status).toBe(401);
  });

  it("creates a Pending review for an authenticated customer", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await listRoute.POST(jsonRequest("http://test/x", "POST", input), slugParams(recipe.slug));
    expect(response.status).toBe(201);
    const body = (await response.json()) as { review: { status: string } };
    expect(body.review.status).toBe("Pending");
  });

  it("returns 400 for an out-of-range rating", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await listRoute.POST(jsonRequest("http://test/x", "POST", { rating: 9 }), slugParams(recipe.slug));
    expect(response.status).toBe(400);
  });

  it("returns 409 on a duplicate submission", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));
    await submitReview(user.id, recipe.slug, input);

    const response = await listRoute.POST(jsonRequest("http://test/x", "POST", input), slugParams(recipe.slug));
    expect(response.status).toBe(409);
  });
});

describe("GET /api/recipes/[slug]/reviews", () => {
  it("does not require auth and only returns Approved reviews", async () => {
    mockAuth.mockResolvedValue(null);
    const recipe = await makeRecipe();
    const user = await makeUser();
    const review = await submitReview(user.id, recipe.slug, input);
    await advanceRecipeReviewToApproved(review.id);

    const response = await listRoute.GET(new Request(`http://test/x?sort=recent`), slugParams(recipe.slug));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { total: number };
    expect(body.total).toBe(1);
  });
});

describe("GET /api/recipes/[slug]/reviews/mine", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const recipe = await makeRecipe();

    const response = await mineRoute.GET(new Request("http://test/x"), slugParams(recipe.slug));
    expect(response.status).toBe(401);
  });

  it("returns null when the customer has no review yet", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await mineRoute.GET(new Request("http://test/x"), slugParams(recipe.slug));
    const body = (await response.json()) as { review: unknown };
    expect(body.review).toBeNull();
  });
});

describe("PATCH/DELETE /api/recipes/[slug]/reviews/[reviewId]", () => {
  it("PATCH returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const recipe = await makeRecipe();

    const response = await itemRoute.PATCH(jsonRequest("http://test/x", "PATCH", input), reviewParams(recipe.slug, "any"));
    expect(response.status).toBe(401);
  });

  it("PATCH edits a Pending review", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));
    const review = await submitReview(user.id, recipe.slug, { rating: 2 });

    const response = await itemRoute.PATCH(
      jsonRequest("http://test/x", "PATCH", { rating: 5, reviewText: "Updated" }),
      reviewParams(recipe.slug, review.id),
    );
    expect(response.status).toBe(200);
  });

  it("DELETE returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const recipe = await makeRecipe();

    const response = await itemRoute.DELETE(new Request("http://test/x", { method: "DELETE" }), reviewParams(recipe.slug, "any"));
    expect(response.status).toBe(401);
  });

  it("DELETE withdraws a Pending review with 204", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));
    const review = await submitReview(user.id, recipe.slug, { rating: 2 });

    const response = await itemRoute.DELETE(new Request("http://test/x", { method: "DELETE" }), reviewParams(recipe.slug, review.id));
    expect(response.status).toBe(204);
  });

  it("DELETE returns 404 for a non-existent review ID", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await itemRoute.DELETE(new Request("http://test/x", { method: "DELETE" }), reviewParams(recipe.slug, "nope"));
    expect(response.status).toBe(404);
  });
});
