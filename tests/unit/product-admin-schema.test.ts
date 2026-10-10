import { describe, expect, it } from "vitest";

import { productAdminSchema } from "@/validation/product-admin.schema";

const validNutrition = { servingSize: "100g", calories: 0, protein: 0, fat: 0, saturatedFat: 0, carbohydrates: 0, sugar: 0, fibre: 0, sodium: 0 };

function baseProduct(overrides: Partial<Parameters<typeof productAdminSchema.parse>[0]> = {}) {
  return {
    name: "Seafood Chilli Paste",
    slug: "seafood-chilli-paste",
    sku: "SKU-1",
    categoryIds: ["cat-1"],
    nutrition: validNutrition,
    images: [],
    ...overrides,
  };
}

/**
 * Regression coverage for the bug where every Media-Library-sourced image
 * silently failed to save: LocalDiskStorageProvider returns a root-relative
 * `/media-files/<filename>` url (see local-disk-storage.provider.ts), which
 * plain Zod `.url()` rejects outright — and the form had no visible error
 * for it, so the rejected save looked identical to a successful no-op one.
 */
describe("productAdminSchema — images/videos url", () => {
  it("accepts a Media-Library-style root-relative path", () => {
    const result = productAdminSchema.safeParse(
      baseProduct({ images: [{ url: "/media-files/442412e5-c57b-4536-918b-13d1e1b152d2-chili-paste-large.png" }] }),
    );
    expect(result.success).toBe(true);
  });

  it("still accepts a directly-typed absolute URL", () => {
    const result = productAdminSchema.safeParse(baseProduct({ images: [{ url: "https://cdn.example.com/chili-paste.png" }] }));
    expect(result.success).toBe(true);
  });

  it("rejects an empty string and a bare filename with no leading slash", () => {
    expect(productAdminSchema.safeParse(baseProduct({ images: [{ url: "" }] })).success).toBe(false);
    expect(productAdminSchema.safeParse(baseProduct({ images: [{ url: "chili-paste.png" }] })).success).toBe(false);
  });

  it("applies the same acceptance rule to videos", () => {
    const relative = productAdminSchema.safeParse(baseProduct({ videos: [{ url: "/media-files/demo.mp4" }] }));
    const bare = productAdminSchema.safeParse(baseProduct({ videos: [{ url: "demo.mp4" }] }));
    expect(relative.success).toBe(true);
    expect(bare.success).toBe(false);
  });
});
