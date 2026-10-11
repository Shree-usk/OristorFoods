import { describe, expect, it } from "vitest";

import { collectionAdminSchema } from "@/validation/collection-admin.schema";

function baseCollection(overrides: Partial<Parameters<typeof collectionAdminSchema.parse>[0]> = {}) {
  return {
    name: "Festive Gift Collection",
    slug: "festive-gift-collection",
    ...overrides,
  };
}

describe("collectionAdminSchema — required fields", () => {
  it("accepts the minimal valid shape", () => {
    expect(collectionAdminSchema.safeParse(baseCollection()).success).toBe(true);
  });

  it("rejects a missing name or slug", () => {
    expect(collectionAdminSchema.safeParse(baseCollection({ name: "" })).success).toBe(false);
    expect(collectionAdminSchema.safeParse(baseCollection({ slug: "" })).success).toBe(false);
  });

  it("rejects a slug with uppercase or spaces", () => {
    expect(collectionAdminSchema.safeParse(baseCollection({ slug: "Festive Gifts" })).success).toBe(false);
  });
});

/** Same regression this project already hit on Category/Product image fields — see product-admin-schema.test.ts. */
describe("collectionAdminSchema — image url", () => {
  it("accepts a Media-Library-style root-relative path", () => {
    expect(collectionAdminSchema.safeParse(baseCollection({ image: "/media-files/gift-box.png" })).success).toBe(true);
  });

  it("accepts a directly-typed absolute URL", () => {
    expect(collectionAdminSchema.safeParse(baseCollection({ image: "https://cdn.example.com/gift-box.png" })).success).toBe(true);
  });

  it("accepts a blank string (cleared field)", () => {
    expect(collectionAdminSchema.safeParse(baseCollection({ image: "" })).success).toBe(true);
  });
});

describe("collectionAdminSchema — dates", () => {
  it("accepts a plain date <input> string, and a blank one", () => {
    expect(collectionAdminSchema.safeParse(baseCollection({ startDate: "2026-04-01", endDate: "2026-04-30" })).success).toBe(true);
    expect(collectionAdminSchema.safeParse(baseCollection({ startDate: "", endDate: "" })).success).toBe(true);
  });
});

describe("collectionAdminSchema — partial (update) use", () => {
  it("allows a single-field patch with everything else omitted", () => {
    expect(collectionAdminSchema.partial().safeParse({ status: "Inactive" }).success).toBe(true);
  });
});
