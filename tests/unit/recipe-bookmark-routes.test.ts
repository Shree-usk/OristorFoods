// tests/unit/recipe-bookmark-routes.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

import { prisma } from "@/lib/db";
import { createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";
import { computeTotalTimeMinutes } from "@/lib/recipe-time";
import { addBookmark } from "@/services/recipe-bookmark.service";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const { auth } = await import("@/lib/auth");
const bookmarkRoute = await import("@/app/api/recipes/[slug]/bookmark/route");
const listRoute = await import("@/app/api/recipes/bookmarks/route");
const mergeRoute = await import("@/app/api/recipes/bookmarks/merge/route");
const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

let sequence = 0;

function sessionFor(userId: string): Session {
  return { user: { id: userId, name: null, email: null, image: null }, expires: "2099-01-01T00:00:00.000Z" };
}

function slugParams(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}

async function makeRecipe(status: "Published" | "Draft" = "Published") {
  sequence += 1;
  const category = await createRecipeCategory({ name: `Category ${sequence}`, slug: `rb-route-category-${sequence}` });
  return createRecipe({
    slug: `rb-route-recipe-${sequence}`,
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
  return prisma.user.create({ data: { email: `rb-route-${sequence}@test.com`, name: "Bookmark Tester" } });
}

afterEach(async () => {
  vi.clearAllMocks();
  await prisma.recipeBookmark.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.recipeCategory.deleteMany();
});

describe("POST/DELETE /api/recipes/[slug]/bookmark", () => {
  it("POST returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const recipe = await makeRecipe();

    const response = await bookmarkRoute.POST(new Request("http://test/x", { method: "POST" }), slugParams(recipe.slug));
    expect(response.status).toBe(401);
  });

  it("POST bookmarks a Published recipe for the authenticated customer", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await bookmarkRoute.POST(new Request("http://test/x", { method: "POST" }), slugParams(recipe.slug));
    expect(response.status).toBe(200);
  });

  it("POST returns 404 for a Draft recipe's slug", async () => {
    const recipe = await makeRecipe("Draft");
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await bookmarkRoute.POST(new Request("http://test/x", { method: "POST" }), slugParams(recipe.slug));
    expect(response.status).toBe(404);
  });

  it("DELETE returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const recipe = await makeRecipe();

    const response = await bookmarkRoute.DELETE(new Request("http://test/x", { method: "DELETE" }), slugParams(recipe.slug));
    expect(response.status).toBe(401);
  });

  it("DELETE removes an existing bookmark", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    await addBookmark(user.id, recipe.slug);
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await bookmarkRoute.DELETE(new Request("http://test/x", { method: "DELETE" }), slugParams(recipe.slug));
    expect(response.status).toBe(200);
  });
});

describe("GET /api/recipes/bookmarks", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await listRoute.GET();
    expect(response.status).toBe(401);
  });

  it("returns the customer's bookmarked recipes as RecipeCard[]", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    await addBookmark(user.id, recipe.slug);
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await listRoute.GET();
    const body = (await response.json()) as { items: Array<{ id: string; slug: string }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.slug).toBe(recipe.slug);
  });
});

describe("POST /api/recipes/bookmarks/merge", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await mergeRoute.POST(jsonRequest("http://test/x", "POST", { recipeIds: [] }));
    expect(response.status).toBe(401);
  });

  it("returns 400 for a malformed body", async () => {
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await mergeRoute.POST(jsonRequest("http://test/x", "POST", { recipeIds: "not-an-array" }));
    expect(response.status).toBe(400);
  });

  it("merges valid recipe ids into the customer's bookmarks", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await mergeRoute.POST(jsonRequest("http://test/x", "POST", { recipeIds: [recipe.id] }));
    expect(response.status).toBe(200);

    const listResponse = await listRoute.GET();
    const body = (await listResponse.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });
});
