import { describe, expect, it } from "vitest";
import { foodAcademyCategoryAdminSchema, foodAcademyEntryAdminSchema, foodAcademyPageSettingAdminSchema, foodAcademyReorderSchema } from "@/validation/food-academy-admin.schema";

describe("foodAcademyCategoryAdminSchema", () => {
  it("rejects a slug with uppercase or spaces", () => {
    expect(foodAcademyCategoryAdminSchema.safeParse({ name: "Ingredients", slug: "Not A Slug" }).success).toBe(false);
  });

  it("accepts a minimal valid category", () => {
    const result = foodAcademyCategoryAdminSchema.safeParse({ name: "Ingredients", slug: "ingredients" });
    expect(result.success).toBe(true);
  });
});

describe("foodAcademyEntryAdminSchema", () => {
  it("defaults isFeatured/sections/recipeIds/productIds when omitted", () => {
    const result = foodAcademyEntryAdminSchema.safeParse({
      slug: "test-entry",
      title: "Test Entry",
      summary: "A summary.",
      contentType: "Article",
      categoryId: "cat_1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isFeatured).toBe(false);
      expect(result.data.sections).toEqual([]);
      expect(result.data.recipeIds).toEqual([]);
      expect(result.data.productIds).toEqual([]);
    }
  });

  it("rejects an unknown contentType", () => {
    const result = foodAcademyEntryAdminSchema.safeParse({
      slug: "test-entry",
      title: "Test Entry",
      summary: "A summary.",
      contentType: "Recipe",
      categoryId: "cat_1",
    });
    expect(result.success).toBe(false);
  });

  it("validates each section's required fields", () => {
    const result = foodAcademyEntryAdminSchema.safeParse({
      slug: "test-entry",
      title: "Test Entry",
      summary: "A summary.",
      contentType: "Course",
      categoryId: "cat_1",
      sections: [{ sectionNumber: 1, title: "", bodyContent: "..." }],
    });
    expect(result.success).toBe(false);
  });
});

describe("foodAcademyReorderSchema", () => {
  it("rejects an empty orderedIds array", () => {
    expect(foodAcademyReorderSchema.safeParse({ orderedIds: [] }).success).toBe(false);
  });

  it("accepts a non-empty orderedIds array", () => {
    expect(foodAcademyReorderSchema.safeParse({ orderedIds: ["a", "b"] }).success).toBe(true);
  });
});

describe("foodAcademyPageSettingAdminSchema", () => {
  it("accepts an empty object (every field optional)", () => {
    expect(foodAcademyPageSettingAdminSchema.safeParse({}).success).toBe(true);
  });

  it("accepts explicit nulls to clear a field", () => {
    const result = foodAcademyPageSettingAdminSchema.safeParse({ heroEyebrow: null, heroImageUrl: null });
    expect(result.success).toBe(true);
  });
});
