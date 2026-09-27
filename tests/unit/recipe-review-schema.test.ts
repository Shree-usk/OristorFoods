import { describe, expect, it } from "vitest";

import { recipeReviewInputSchema } from "@/validation/recipe-review.schema";

describe("recipeReviewInputSchema", () => {
  it("accepts a rating with no review text", () => {
    const parsed = recipeReviewInputSchema.safeParse({ rating: 4 });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.reviewText).toBeUndefined();
  });

  it("treats an empty-string reviewText the same as omitted (RHF submits \"\" for an untouched textarea)", () => {
    const parsed = recipeReviewInputSchema.safeParse({ rating: 4, reviewText: "" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.reviewText).toBeUndefined();
  });

  it("rejects a rating outside 1-5", () => {
    expect(recipeReviewInputSchema.safeParse({ rating: 0 }).success).toBe(false);
    expect(recipeReviewInputSchema.safeParse({ rating: 6 }).success).toBe(false);
  });

  it("rejects review text over 2000 characters", () => {
    const parsed = recipeReviewInputSchema.safeParse({ rating: 5, reviewText: "a".repeat(2001) });
    expect(parsed.success).toBe(false);
  });
});
