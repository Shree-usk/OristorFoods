// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  createRecipe,
  getFeaturedRecipes,
  listRecipeFacets,
  listRecipes,
  registerRecipeProviders,
  searchRecipeSuggestions,
} from "@/services/recipe.service";
import { resetSearchExtensionsForTesting, searchRecipes } from "@/services/search-extensions";
import { recipeListingQuerySchema } from "@/validation/recipe-listing.schema";
import { cleanupRecipes, makeCategory, makeDietaryTag, makeRecipe } from "./recipe-fixtures";

afterEach(async () => {
  resetSearchExtensionsForTesting();
  await cleanupRecipes();
});

describe("createRecipe", () => {
  it("derives totalTimeMinutes from prep + cook and links dietary tags", async () => {
    const category = await makeCategory();
    const vegan = await makeDietaryTag({ name: "Vegan" });

    const recipe = await createRecipe({
      slug: "dhal-curry",
      title: "Dhal Curry",
      shortDescription: "Red lentils in coconut milk.",
      heroImage: "/images/products/export/turmeric-powder.webp",
      heroImageAlt: "Oristor turmeric powder, used in this recipe",
      categoryId: category.id,
      difficulty: "Easy",
      prepTimeMinutes: 5,
      cookTimeMinutes: 25,
      servings: 4,
      status: "Published",
      dietaryTagIds: [vegan.id],
    });

    expect(recipe.totalTimeMinutes).toBe(30);
    expect(await prisma.recipeDietaryTag.count({ where: { recipeId: recipe.id } })).toBe(1);
  });
});

describe("listRecipes", () => {
  it("maps rows to RecipeCard and echoes page and pageSize", async () => {
    const category = await makeCategory({ name: "Curries" });
    const spicy = await makeDietaryTag({ name: "Spicy" });
    await makeRecipe(category.id, {
      slug: "chicken-curry",
      title: "Chicken Curry",
      cuisine: "Sri Lankan",
      difficulty: "Medium",
      prepTimeMinutes: 15,
      cookTimeMinutes: 45,
      avgRating: 4.9,
      ratingCount: 58,
      dietaryTagIds: [spicy.id],
    });

    const result = await listRecipes(recipeListingQuerySchema.parse({}));

    expect(result).toEqual({
      recipes: [
        {
          id: expect.any(String),
          slug: "chicken-curry",
          href: "/recipes/chicken-curry",
          title: "Chicken Curry",
          heroImage: "/images/products/export/curry-powder.webp",
          heroImageAlt: "Test hero image",
          categoryName: "Curries",
          cuisine: "Sri Lankan",
          difficulty: "Medium",
          totalTimeMinutes: 60,
          avgRating: 4.9,
          ratingCount: 58,
          dietaryTags: ["Spicy"],
        },
      ],
      total: 1,
      page: 1,
      pageSize: 12,
    });
  });

  it("keeps a missing rating as null", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id);

    const result = await listRecipes(recipeListingQuerySchema.parse({}));

    expect(result.recipes[0].avgRating).toBeNull();
    expect(result.recipes[0].ratingCount).toBe(0);
  });

  it("applies filters, sort and paging from the query", async () => {
    const category = await makeCategory({ slug: "curries" });
    for (let i = 1; i <= 3; i += 1) {
      await makeRecipe(category.id, { title: `Curry ${i}`, prepTimeMinutes: 0, cookTimeMinutes: i });
    }
    await makeRecipe((await makeCategory()).id, { title: "Elsewhere" });

    const result = await listRecipes(
      recipeListingQuerySchema.parse({ category: "curries", sort: "time", page: "2", pageSize: "2" }),
    );

    expect(result.total).toBe(3);
    expect(result.page).toBe(2);
    expect(result.recipes.map((recipe) => recipe.title)).toEqual(["Curry 3"]);
  });
});

describe("listRecipeFacets", () => {
  it("returns categories and dietary tags as name/slug pairs", async () => {
    const category = await makeCategory({ name: "Snacks", slug: "snacks" });
    const vegan = await makeDietaryTag({ name: "Vegan", slug: "vegan" });
    await makeRecipe(category.id, { dietaryTagIds: [vegan.id] });

    expect(await listRecipeFacets()).toEqual({
      categories: [{ name: "Snacks", slug: "snacks" }],
      dietaryTags: [{ name: "Vegan", slug: "vegan" }],
    });
  });
});

describe("getFeaturedRecipes", () => {
  it("returns at most 4 featured Published recipes by default", async () => {
    const category = await makeCategory();
    for (let i = 1; i <= 5; i += 1) {
      await makeRecipe(category.id, { title: `Featured ${i}`, isFeatured: true });
    }

    expect(await getFeaturedRecipes()).toHaveLength(4);
  });
});

describe("recipe search provider", () => {
  it("returns Published matches as suggestions, most viewed first, up to the limit", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id, { slug: "coconut-sambol", title: "Coconut Sambol", viewCount: 5 });
    await makeRecipe(category.id, { slug: "seeni-sambol", title: "Seeni Sambol", viewCount: 50 });
    await makeRecipe(category.id, { slug: "draft-sambol", title: "Draft Sambol", status: "Draft" });

    expect(await searchRecipeSuggestions("sambol", 5)).toEqual([
      { id: expect.any(String), label: "Seeni Sambol", href: "/recipes/seeni-sambol", imageSrc: "/images/products/export/curry-powder.webp", type: "Recipe" },
      { id: expect.any(String), label: "Coconut Sambol", href: "/recipes/coconut-sambol", imageSrc: "/images/products/export/curry-powder.webp", type: "Recipe" },
    ]);
    expect(await searchRecipeSuggestions("sambol", 1)).toHaveLength(1);
    expect(await searchRecipeSuggestions("   ", 5)).toEqual([]);
  });

  it("is what Global Search uses once registerRecipeProviders() runs", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id, { slug: "dhal-curry", title: "Dhal Curry" });

    expect(await searchRecipes("dhal", 5)).toEqual([]);
    registerRecipeProviders();
    expect((await searchRecipes("dhal", 5)).map((item) => item.href)).toEqual(["/recipes/dhal-curry"]);
  });
});
