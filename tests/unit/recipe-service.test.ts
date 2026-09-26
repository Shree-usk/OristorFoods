// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { findPublishedRecipeBySlug } from "@/repositories/recipe.repository";
import { getRecipeSummary, resetProductDetailExtensionsForTesting } from "@/services/product-detail-extensions";
import {
  createRecipe,
  getFeaturedRecipes,
  getRecipeBySlug,
  getRecipesByProductId,
  getRelatedRecipes,
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
  resetProductDetailExtensionsForTesting();
  await cleanupRecipes();
  await prisma.product.deleteMany();
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
          hasVideo: false,
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

describe("toRecipeCard hasVideo", () => {
  it("maps hasVideo true/false correctly", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id, { title: "Video One", videoUrl: "https://youtu.be/abc123", videoProvider: "Youtube" });
    await makeRecipe(category.id, { title: "No Video One" });

    const result = await listRecipes({ page: 1, pageSize: 10, sort: "newest" });
    const videoCard = result.recipes.find((r) => r.title === "Video One");
    const noVideoCard = result.recipes.find((r) => r.title === "No Video One");
    expect(videoCard?.hasVideo).toBe(true);
    expect(noVideoCard?.hasVideo).toBe(false);
  });

  it("is false when videoUrl is set but videoProvider is null (not actually playable)", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id, { title: "URL Without Provider", videoUrl: "https://youtu.be/abc123", videoProvider: null });

    const result = await listRecipes({ page: 1, pageSize: 10, sort: "newest" });
    const card = result.recipes.find((r) => r.title === "URL Without Provider");
    expect(card?.hasVideo).toBe(false);
  });
});

describe("getRecipeBySlug video field", () => {
  it("maps the video object when present, null when absent", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id, {
      slug: "with-video", videoUrl: "https://youtu.be/abc123", videoProvider: "Youtube",
      videoDurationSeconds: 300, captionsUrl: null,
    });
    await makeRecipe(category.id, { slug: "without-video" });

    const withVideo = await getRecipeBySlug("with-video");
    const withoutVideo = await getRecipeBySlug("without-video");
    expect(withVideo?.video).toEqual({ url: "https://youtu.be/abc123", provider: "Youtube", durationSeconds: 300, captionsUrl: null });
    expect(withoutVideo?.video).toBeNull();
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

  it("is also what the PDP's recipe summary uses once registerRecipeProviders() runs", async () => {
    const category = await makeCategory();
    const product = await createProduct({ sku: "SKU-T5-PROVIDER", slug: "provider-product", name: "Provider Product" });
    await makeRecipe(category.id, {
      slug: "uses-provider-product",
      title: "Uses Provider Product",
      ingredients: [{ productId: product.id, displayText: "Some of it" }],
    });

    expect(await getRecipeSummary(product.id)).toBeNull();
    registerRecipeProviders();
    expect(await getRecipeSummary(product.id)).toEqual({
      recipes: [
        {
          id: expect.any(String),
          title: "Uses Provider Product",
          slug: "uses-provider-product",
          imageSrc: "/images/products/export/curry-powder.webp",
        },
      ],
    });
  });
});

describe("getRecipeBySlug", () => {
  it("returns null for a missing slug", async () => {
    expect(await getRecipeBySlug("does-not-exist")).toBeNull();
  });

  it("returns null for a non-Published recipe", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id, { slug: "draft-recipe", status: "Draft" });

    expect(await getRecipeBySlug("draft-recipe")).toBeNull();
  });

  it("maps every RecipeDetail field, including ingredients, steps, dietary tags and related recipes, and increments the view count", async () => {
    const category = await makeCategory({ name: "Curries", slug: "curries-t5" });
    const spicy = await makeDietaryTag({ name: "Spicy", slug: "spicy-t5" });
    const product = await createProduct({ sku: "SKU-T5-1", slug: "curry-powder-t5", name: "Curry Powder" });

    const recipe = await makeRecipe(category.id, {
      slug: "full-recipe",
      title: "Full Recipe",
      shortDescription: "A fully specified test recipe.",
      cuisine: "Sri Lankan",
      difficulty: "Medium",
      prepTimeMinutes: 10,
      cookTimeMinutes: 20,
      avgRating: 4.5,
      ratingCount: 12,
      viewCount: 5,
      publishedAt: new Date("2026-08-01T00:00:00Z"),
      dietaryTagIds: [spicy.id],
      ingredients: [
        { productId: product.id, quantity: 2, unit: "tbsp", displayText: "Curry Powder", sortOrder: 1 },
        { displayText: "Salt, to taste", sortOrder: 2 },
      ],
      steps: [
        { stepNumber: 1, instruction: "Do the first thing" },
        { stepNumber: 2, instruction: "Do the second thing" },
      ],
    });
    // A related recipe in the same category, and an unrelated one that should not appear.
    await makeRecipe(category.id, { slug: "related-recipe", title: "Related Recipe" });
    await makeRecipe((await makeCategory()).id, { slug: "unrelated-recipe", cuisine: "Italian" });

    const result = await getRecipeBySlug("full-recipe");

    expect(result).toMatchObject({
      id: recipe.id,
      slug: "full-recipe",
      href: "/recipes/full-recipe",
      title: "Full Recipe",
      shortDescription: "A fully specified test recipe.",
      heroImage: "/images/products/export/curry-powder.webp",
      heroImageAlt: "Test hero image",
      galleryImageUrls: [],
      categoryName: "Curries",
      categorySlug: "curries-t5",
      cuisine: "Sri Lankan",
      difficulty: "Medium",
      prepTimeMinutes: 10,
      cookTimeMinutes: 20,
      totalTimeMinutes: 30,
      servings: 4,
      avgRating: 4.5,
      ratingCount: 12,
      dietaryTags: [{ name: "Spicy", slug: "spicy-t5" }],
      chefNotes: null,
      nutrition: {
        calories: null,
        protein: null,
        carbs: null,
        fat: null,
        fiber: null,
        sodium: null,
      },
      metaTitle: null,
      metaDescription: null,
      publishedAt: "2026-08-01T00:00:00.000Z",
    });
    expect(result?.ingredients[0]).toMatchObject({
      quantity: 2,
      unit: "tbsp",
      displayText: "Curry Powder",
      product: { slug: "curry-powder-t5", name: "Curry Powder" },
    });
    expect(result?.ingredients[1]).toMatchObject({
      quantity: null,
      unit: null,
      displayText: "Salt, to taste",
      product: null,
    });
    expect(result?.steps).toEqual([
      { stepNumber: 1, instruction: "Do the first thing", imageUrl: null },
      { stepNumber: 2, instruction: "Do the second thing", imageUrl: null },
    ]);
    expect(result?.relatedRecipes.map((r) => r.slug)).toEqual(["related-recipe"]);

    // The service no longer awaits the view-count increment (it's
    // fire-and-forget so a failed UPDATE can't 500 the page), so poll for
    // it instead of asserting it happened synchronously.
    await vi.waitFor(async () => {
      const updated = await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } });
      expect(updated.viewCount).toBe(6);
    });
  });

  it("maps non-null nutrition values", async () => {
    const category = await makeCategory();
    const recipe = await makeRecipe(category.id, { slug: "nutrition-recipe" });
    await prisma.recipe.update({
      where: { id: recipe.id },
      data: {
        chefNotes: "Best served hot.",
        nutritionCalories: 320,
        nutritionProtein: 12,
        nutritionCarbs: 40,
        nutritionFat: 8,
        nutritionFiber: 5,
        nutritionSodium: 600,
      },
    });

    const result = await getRecipeBySlug("nutrition-recipe");

    expect(result?.chefNotes).toBe("Best served hot.");
    expect(result?.nutrition).toEqual({
      calories: 320,
      protein: 12,
      carbs: 40,
      fat: 8,
      fiber: 5,
      sodium: 600,
    });
  });
});

describe("getRelatedRecipes", () => {
  it("returns Published recipes sharing category or cuisine, excluding the recipe itself", async () => {
    const category = await makeCategory();
    const otherCategory = await makeCategory();
    await makeRecipe(category.id, { slug: "target", cuisine: "Sri Lankan" });
    await makeRecipe(category.id, { slug: "same-category" });
    await makeRecipe(otherCategory.id, { slug: "same-cuisine", cuisine: "Sri Lankan" });
    await makeRecipe(otherCategory.id, { slug: "unrelated", cuisine: "Italian" });

    const row = await findPublishedRecipeBySlug("target");
    const related = await getRelatedRecipes(row!, 6);

    expect(related.map((r) => r.slug).sort()).toEqual(["same-category", "same-cuisine"]);
  });
});

describe("getRecipesByProductId", () => {
  it("maps repository rows to RecipePreview shape", async () => {
    const category = await makeCategory();
    const product = await createProduct({ sku: "SKU-T5-2", slug: "product-t5", name: "Product T5" });
    await makeRecipe(category.id, {
      slug: "uses-product",
      title: "Uses Product",
      ingredients: [{ productId: product.id, displayText: "Uses it", sortOrder: 1 }],
    });

    expect(await getRecipesByProductId(product.id)).toEqual([
      {
        id: expect.any(String),
        title: "Uses Product",
        slug: "uses-product",
        imageSrc: "/images/products/export/curry-powder.webp",
      },
    ]);
  });
});
