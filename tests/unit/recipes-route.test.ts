// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { GET as getCategories } from "@/app/api/recipes/categories/route";
import { GET as getRecipes } from "@/app/api/recipes/route";
import { cleanupRecipes, makeCategory, makeDietaryTag, makeRecipe } from "./recipe-fixtures";

afterEach(async () => {
  await cleanupRecipes();
});

describe("GET /api/recipes", () => {
  it("returns Published recipe cards with paging metadata", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id, { title: "Dhal Curry" });
    await makeRecipe(category.id, { title: "Hidden Draft", status: "Draft" });

    const response = await getRecipes(new Request("http://localhost/api/recipes"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recipes.map((recipe: { title: string }) => recipe.title)).toEqual(["Dhal Curry"]);
    expect(body).toMatchObject({ total: 1, page: 1, pageSize: 12 });
  });

  it("applies query filters", async () => {
    const category = await makeCategory();
    const vegan = await makeDietaryTag({ slug: "vegan" });
    await makeRecipe(category.id, { title: "Vegan Dhal", dietaryTagIds: [vegan.id] });
    await makeRecipe(category.id, { title: "Chicken Curry" });

    const response = await getRecipes(new Request("http://localhost/api/recipes?diet=vegan"));
    const body = await response.json();

    expect(body.recipes.map((recipe: { title: string }) => recipe.title)).toEqual(["Vegan Dhal"]);
  });

  it("returns 200 with defaults for a malformed query", async () => {
    const response = await getRecipes(new Request("http://localhost/api/recipes?sort=spiciest&page=-1&difficulty=expert"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ page: 1, pageSize: 12 });
  });
});

describe("GET /api/recipes/categories", () => {
  it("returns categories and dietary tags that have Published recipes", async () => {
    const category = await makeCategory({ name: "Curries", slug: "curries" });
    const spicy = await makeDietaryTag({ name: "Spicy", slug: "spicy" });
    await makeRecipe(category.id, { dietaryTagIds: [spicy.id] });

    const response = await getCategories();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      categories: [{ name: "Curries", slug: "curries" }],
      dietaryTags: [{ name: "Spicy", slug: "spicy" }],
    });
  });
});
