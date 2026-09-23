import { describe, expect, it } from "vitest";

import { reviewInputSchema, reviewListQuerySchema } from "@/validation/review.schema";

const valid = {
  rating: 4,
  title: "Lovely aroma",
  body: "Fresh, fragrant and great in a chicken curry.",
};

describe("reviewInputSchema", () => {
  it("accepts a valid review and trims the text fields", () => {
    const parsed = reviewInputSchema.parse({ ...valid, title: "  Lovely aroma  ", body: `  ${valid.body}  ` });

    expect(parsed).toEqual(valid);
  });

  it.each([0, 6, 3.5])("rejects a rating of %s", (rating) => {
    expect(reviewInputSchema.safeParse({ ...valid, rating }).success).toBe(false);
  });

  it("rejects a missing rating with a friendly message", () => {
    const result = reviewInputSchema.safeParse({ title: valid.title, body: valid.body });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Please choose a star rating");
  });

  it("rejects NaN with the same message", () => {
    const result = reviewInputSchema.safeParse({ ...valid, rating: Number.NaN });

    expect(result.error?.issues[0]?.message).toBe("Please choose a star rating");
  });

  it("measures title length after trimming (3–120)", () => {
    expect(reviewInputSchema.safeParse({ ...valid, title: "  ab  " }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ ...valid, title: "abc" }).success).toBe(true);
    expect(reviewInputSchema.safeParse({ ...valid, title: "a".repeat(121) }).success).toBe(false);
  });

  it("measures body length after trimming (20–2000)", () => {
    expect(reviewInputSchema.safeParse({ ...valid, body: `  ${"a".repeat(19)}  ` }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ ...valid, body: "a".repeat(20) }).success).toBe(true);
    expect(reviewInputSchema.safeParse({ ...valid, body: "a".repeat(2001) }).success).toBe(false);
  });
});

describe("reviewListQuerySchema", () => {
  it("applies defaults when no params are given", () => {
    expect(reviewListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 10, sort: "recent" });
  });

  it("coerces string query params", () => {
    expect(reviewListQuerySchema.parse({ page: "2", pageSize: "20", sort: "lowest", rating: "5" })).toEqual({
      page: 2,
      pageSize: 20,
      sort: "lowest",
      rating: 5,
    });
  });

  it.each([{ pageSize: "51" }, { page: "0" }, { rating: "6" }, { rating: "0" }, { sort: "oldest" }])(
    "rejects %o",
    (query) => {
      expect(reviewListQuerySchema.safeParse(query).success).toBe(false);
    },
  );
});
