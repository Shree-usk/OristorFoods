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

describe("productAdminSchema — Product Story & Export Specifications", () => {
  it("accepts a valid promise attribute and rejects a blank heading", () => {
    const valid = productAdminSchema.safeParse(
      baseProduct({ promiseAttributes: [{ imageUrl: "https://example.com/promise.jpg", heading: "Carefully Cleaned Ingredients" }] }),
    );
    expect(valid.success).toBe(true);

    const blank = productAdminSchema.safeParse(baseProduct({ promiseAttributes: [{ imageUrl: "https://example.com/promise.jpg", heading: "" }] }));
    expect(blank.success).toBe(false);
  });

  it("requires an image for every promise attribute — no curated icon fallback", () => {
    const noImage = productAdminSchema.safeParse(baseProduct({ promiseAttributes: [{ imageUrl: "", heading: "Carefully Cleaned Ingredients" }] }));
    expect(noImage.success).toBe(false);
  });

  it("caps promise attributes at 8", () => {
    const nineAttributes = Array.from({ length: 9 }, (_, i) => ({ imageUrl: "https://example.com/promise.jpg", heading: `Attribute ${i}` }));
    expect(productAdminSchema.safeParse(baseProduct({ promiseAttributes: nineAttributes })).success).toBe(false);
    expect(productAdminSchema.safeParse(baseProduct({ promiseAttributes: nineAttributes.slice(0, 8) })).success).toBe(true);
  });

  it("accepts a valid preparation stage and rejects a missing image URL", () => {
    const valid = productAdminSchema.safeParse(
      baseProduct({ preparationStages: [{ stageNumber: "01", heading: "Carefully Selected", imageUrl: "https://example.com/stage-1.jpg" }] }),
    );
    expect(valid.success).toBe(true);

    const noImage = productAdminSchema.safeParse(baseProduct({ preparationStages: [{ stageNumber: "01", heading: "Carefully Selected" }] }));
    expect(noImage.success).toBe(false);
  });

  it("caps preparation stages at 6", () => {
    const sevenStages = Array.from({ length: 7 }, (_, i) => ({ stageNumber: `0${i}`, heading: `Stage ${i}`, imageUrl: "https://example.com/stage.jpg" }));
    expect(productAdminSchema.safeParse(baseProduct({ preparationStages: sevenStages })).success).toBe(false);
    expect(productAdminSchema.safeParse(baseProduct({ preparationStages: sevenStages.slice(0, 6) })).success).toBe(true);
  });

  it("accepts a known export spec type and rejects an unknown one", () => {
    const valid = productAdminSchema.safeParse(
      baseProduct({ exportSpecItems: [{ specType: "PackSizes", value: "200 g | 350 g", imageUrl: "https://example.com/spec.jpg" }] }),
    );
    expect(valid.success).toBe(true);

    const unknown = productAdminSchema.safeParse(
      baseProduct({ exportSpecItems: [{ specType: "NotARealType", value: "x", imageUrl: "https://example.com/spec.jpg" }] }),
    );
    expect(unknown.success).toBe(false);
  });

  it("requires an image for every export spec item", () => {
    const noImage = productAdminSchema.safeParse(baseProduct({ exportSpecItems: [{ specType: "PackSizes", value: "200 g | 350 g", imageUrl: "" }] }));
    expect(noImage.success).toBe(false);
  });

  it("rejects two export spec items of the same type, matching the DB's @@unique([productId, specType])", () => {
    const result = productAdminSchema.safeParse(
      baseProduct({
        exportSpecItems: [
          { specType: "PackSizes", value: "200 g", imageUrl: "https://example.com/spec.jpg" },
          { specType: "PackSizes", value: "350 g", imageUrl: "https://example.com/spec.jpg" },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("caps export spec items at 10 — one per enum value", () => {
    const allTenTypes = [
      "PackSizes",
      "CartonPacking",
      "Moq",
      "CartonDimensions",
      "GrossCartonWeight",
      "ShelfLife",
      "StorageConditions",
      "PackagingType",
      "ExportAvailability",
      "ShippingTerms",
    ];
    const tenItems = allTenTypes.map((specType) => ({ specType, value: "x", imageUrl: "https://example.com/spec.jpg" }));
    expect(productAdminSchema.safeParse(baseProduct({ exportSpecItems: tenItems })).success).toBe(true);
  });
});
