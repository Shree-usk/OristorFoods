import { describe, expect, it } from "vitest";

import { addWishlistItemSchema, mergeWishlistSchema } from "@/validation/wishlist.schema";

describe("addWishlistItemSchema", () => {
  it("accepts a valid product id", () => {
    expect(addWishlistItemSchema.safeParse({ productId: "p1" }).success).toBe(true);
  });

  it("rejects a missing product id", () => {
    expect(addWishlistItemSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an empty product id", () => {
    expect(addWishlistItemSchema.safeParse({ productId: "" }).success).toBe(false);
  });
});

describe("mergeWishlistSchema", () => {
  it("accepts an array of product ids", () => {
    expect(mergeWishlistSchema.safeParse({ productIds: ["p1", "p2"] }).success).toBe(true);
  });

  it("accepts an empty array", () => {
    expect(mergeWishlistSchema.safeParse({ productIds: [] }).success).toBe(true);
  });

  it("rejects more than 200 ids", () => {
    const productIds = Array.from({ length: 201 }, (_, i) => `p${i}`);
    expect(mergeWishlistSchema.safeParse({ productIds }).success).toBe(false);
  });

  it("rejects a non-array productIds", () => {
    expect(mergeWishlistSchema.safeParse({ productIds: "p1" }).success).toBe(false);
  });
});
