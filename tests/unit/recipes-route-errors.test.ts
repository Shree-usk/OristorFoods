// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/recipe.service", () => ({
  listRecipes: vi.fn().mockRejectedValue(new Error("database unavailable")),
  listRecipeFacets: vi.fn().mockRejectedValue(new Error("database unavailable")),
}));

import { GET as getCategories } from "@/app/api/recipes/categories/route";
import { GET as getRecipes } from "@/app/api/recipes/route";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("recipe routes on failure", () => {
  it("GET /api/recipes returns a generic 500 and logs the error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await getRecipes(new Request("http://localhost/api/recipes"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Something went wrong. Please try again." });
    expect(consoleError).toHaveBeenCalledWith("[GET /api/recipes]", expect.any(Error));
  });

  it("GET /api/recipes/categories returns a generic 500 and logs the error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await getCategories();

    expect(response.status).toBe(500);
    expect(consoleError).toHaveBeenCalledWith("[GET /api/recipes/categories]", expect.any(Error));
  });
});
