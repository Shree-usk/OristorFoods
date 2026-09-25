// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { GET } from "@/app/api/recipes/[slug]/route";
import { cleanupRecipes, makeCategory, makeRecipe } from "./recipe-fixtures";

afterEach(async () => {
  await cleanupRecipes();
});

describe("GET /api/recipes/[slug]", () => {
  it("returns 200 with the recipe detail for a valid published slug", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id, { slug: "dhal-curry", title: "Dhal Curry" });

    const response = await GET(new Request("http://localhost/api/recipes/dhal-curry"), {
      params: Promise.resolve({ slug: "dhal-curry" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.slug).toBe("dhal-curry");
    expect(body.title).toBe("Dhal Curry");
  });

  it("returns 404 for a nonexistent slug", async () => {
    const response = await GET(new Request("http://localhost/api/recipes/missing"), {
      params: Promise.resolve({ slug: "missing" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 404 for a Draft recipe (not just missing ones)", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id, { slug: "draft-recipe", status: "Draft" });

    const response = await GET(new Request("http://localhost/api/recipes/draft-recipe"), {
      params: Promise.resolve({ slug: "draft-recipe" }),
    });
    expect(response.status).toBe(404);
  });
});
