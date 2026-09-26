// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { GET as getEntries } from "@/app/api/food-academy/route";
import { GET as getCategories } from "@/app/api/food-academy/categories/route";
import { GET as getEntry } from "@/app/api/food-academy/[slug]/route";
import { cleanupRecipes, makeFoodAcademyCategory, makeFoodAcademyEntry } from "./recipe-fixtures";

afterEach(async () => {
  await cleanupRecipes();
});

describe("GET /api/food-academy", () => {
  it("returns Published entries with paging metadata", async () => {
    const category = await makeFoodAcademyCategory();
    await makeFoodAcademyEntry({ title: "Published Entry", categoryId: category.id });
    await makeFoodAcademyEntry({ title: "Draft Entry", categoryId: category.id, status: "Draft" });

    const response = await getEntries(new Request("http://localhost/api/food-academy"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.entries.map((e: { title: string }) => e.title)).toEqual(["Published Entry"]);
  });
});

describe("GET /api/food-academy/categories", () => {
  it("returns active categories", async () => {
    await makeFoodAcademyCategory({ name: "Ingredients" });
    const response = await getCategories(new Request("http://localhost/api/food-academy/categories"));
    expect(response.status).toBe(200);
    expect((await response.json()).map((c: { name: string }) => c.name)).toEqual(["Ingredients"]);
  });
});

describe("GET /api/food-academy/[slug]", () => {
  it("returns 200 for a Published slug, 404 for missing/Draft", async () => {
    const category = await makeFoodAcademyCategory();
    await makeFoodAcademyEntry({ slug: "published-entry", categoryId: category.id });
    await makeFoodAcademyEntry({ slug: "draft-entry", categoryId: category.id, status: "Draft" });

    const ok = await getEntry(new Request("http://localhost/api/food-academy/published-entry"), {
      params: Promise.resolve({ slug: "published-entry" }),
    });
    expect(ok.status).toBe(200);

    const draftResponse = await getEntry(new Request("http://localhost/api/food-academy/draft-entry"), {
      params: Promise.resolve({ slug: "draft-entry" }),
    });
    expect(draftResponse.status).toBe(404);
  });
});
