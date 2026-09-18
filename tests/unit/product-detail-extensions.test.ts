import { afterEach, describe, expect, it } from "vitest";

import {
  getQaSummary,
  getRecipeSummary,
  getReviewSummary,
  registerQaSummaryProvider,
  registerRecipeSummaryProvider,
  registerReviewSummaryProvider,
  resetProductDetailExtensionsForTesting,
} from "@/services/product-detail-extensions";

afterEach(() => {
  resetProductDetailExtensionsForTesting();
});

describe("product-detail-extensions", () => {
  it("returns null from every summary before a provider is registered", async () => {
    expect(await getReviewSummary("p1")).toBeNull();
    expect(await getQaSummary("p1")).toBeNull();
    expect(await getRecipeSummary("p1")).toBeNull();
  });

  it("returns the registered review summary provider's result", async () => {
    registerReviewSummaryProvider(async () => ({
      averageRating: 4.2,
      reviewCount: 10,
      previewReviews: [
        { id: "r1", authorName: "Kasun", rating: 5, title: "Great", body: "Loved it", createdAt: new Date() },
      ],
    }));

    expect((await getReviewSummary("p1"))?.averageRating).toBe(4.2);
  });

  it("returns the registered QA summary provider's result", async () => {
    registerQaSummaryProvider(async () => ({
      previewItems: [{ id: "q1", question: "Is it spicy?", answer: "Mildly", createdAt: new Date() }],
      totalCount: 1,
    }));

    expect((await getQaSummary("p1"))?.totalCount).toBe(1);
  });

  it("returns the registered recipe summary provider's result", async () => {
    registerRecipeSummaryProvider(async () => ({
      recipes: [{ id: "rec1", title: "Curry", slug: "curry", imageSrc: "/x.jpg" }],
    }));

    expect((await getRecipeSummary("p1"))?.recipes).toHaveLength(1);
  });
});
