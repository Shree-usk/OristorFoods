// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { findReviewById } from "@/repositories/review.repository";
import { registerPurchaseVerifier, resetPurchaseVerifierForTesting } from "@/services/purchase-verification";
import {
  DuplicateReviewError,
  InvalidReviewInputError,
  ProductNotFoundError,
  ReviewForbiddenError,
  ReviewNotEditableError,
  ReviewNotFoundError,
} from "@/services/review.errors";
import {
  changeReviewStatus,
  editOwnPendingReview,
  getMyReview,
  listPublishedReviews,
  submitReview,
  withdrawOwnPendingReview,
} from "@/services/review.service";

const input = { rating: 4, title: "Great colour", body: "Bright red colour and a steady, even heat." };
const defaultQuery = { page: 1, pageSize: 10, sort: "recent" as const };
let sequence = 0;

async function makeProduct(status: "Published" | "Draft" = "Published") {
  sequence += 1;
  return createProduct({ sku: `REV-SVC-${sequence}`, slug: `rev-svc-${sequence}`, name: "Chilli Powder", status });
}

async function makeUser(name: string | null = "Kasun Perera") {
  sequence += 1;
  return prisma.user.create({ data: { email: `rev-svc-${sequence}@test.com`, name } });
}

async function publish(reviewId: string) {
  await changeReviewStatus(reviewId, "Approved");
  await changeReviewStatus(reviewId, "Published");
}

afterEach(async () => {
  resetPurchaseVerifierForTesting();
  await prisma.productRatingSummary.deleteMany();
  await prisma.review.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
});

describe("submitReview", () => {
  it("creates a Pending review, not verified by default", async () => {
    const product = await makeProduct();
    const user = await makeUser();

    const review = await submitReview(user.id, product.slug, input);

    expect(review).toMatchObject({ ...input, status: "Pending" });
    expect((await findReviewById(review.id))?.isVerifiedPurchase).toBe(false);
  });

  it("flags a verified purchase when the registered verifier says so", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    registerPurchaseVerifier(async (userId, productId) => userId === user.id && productId === product.id);

    const review = await submitReview(user.id, product.slug, input);

    expect((await findReviewById(review.id))?.isVerifiedPurchase).toBe(true);
  });

  it("rejects an unknown or unpublished product", async () => {
    const draft = await makeProduct("Draft");
    const user = await makeUser();

    await expect(submitReview(user.id, draft.slug, input)).rejects.toBeInstanceOf(ProductNotFoundError);
    await expect(submitReview(user.id, "no-such-product", input)).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it("re-validates input for non-API callers", async () => {
    const product = await makeProduct();
    const user = await makeUser();

    await expect(submitReview(user.id, product.slug, { ...input, rating: 7 })).rejects.toBeInstanceOf(InvalidReviewInputError);
  });

  it("rejects a second review from the same customer", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    await submitReview(user.id, product.slug, input);

    await expect(submitReview(user.id, product.slug, input)).rejects.toBeInstanceOf(DuplicateReviewError);
  });

  it("lets exactly one of two concurrent submissions through", async () => {
    const product = await makeProduct();
    const user = await makeUser();

    const results = await Promise.allSettled([
      submitReview(user.id, product.slug, input),
      submitReview(user.id, product.slug, input),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejection = results.find((result) => result.status === "rejected");
    expect(rejection?.status === "rejected" && rejection.reason).toBeInstanceOf(DuplicateReviewError);
  });
});

describe("getMyReview", () => {
  it("returns null before reviewing and the review (any status) after", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    expect(await getMyReview(user.id, product.slug)).toBeNull();

    const review = await submitReview(user.id, product.slug, input);

    expect(await getMyReview(user.id, product.slug)).toEqual(review);
  });
});

describe("editOwnPendingReview", () => {
  it("updates the customer's own Pending review", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    const review = await submitReview(user.id, product.slug, input);

    const edited = await editOwnPendingReview(user.id, product.slug, review.id, { ...input, rating: 2, title: "Changed my mind" });

    expect(edited).toMatchObject({ rating: 2, title: "Changed my mind", status: "Pending" });
  });

  it("refuses another customer's review", async () => {
    const product = await makeProduct();
    const review = await submitReview((await makeUser()).id, product.slug, input);
    const intruder = await makeUser();

    await expect(editOwnPendingReview(intruder.id, product.slug, review.id, input)).rejects.toBeInstanceOf(ReviewForbiddenError);
  });

  it("refuses once the review has left Pending", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    const review = await submitReview(user.id, product.slug, input);
    await changeReviewStatus(review.id, "Approved");

    await expect(editOwnPendingReview(user.id, product.slug, review.id, input)).rejects.toBeInstanceOf(ReviewNotEditableError);
  });

  it("treats a review that belongs to a different product as not found", async () => {
    const product = await makeProduct();
    const otherProduct = await makeProduct();
    const user = await makeUser();
    const review = await submitReview(user.id, product.slug, input);

    await expect(editOwnPendingReview(user.id, otherProduct.slug, review.id, input)).rejects.toBeInstanceOf(ReviewNotFoundError);
  });
});

describe("withdrawOwnPendingReview", () => {
  it("deletes the Pending review so the customer can write a fresh one", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    const review = await submitReview(user.id, product.slug, input);

    await withdrawOwnPendingReview(user.id, product.slug, review.id);

    expect(await findReviewById(review.id)).toBeNull();
    await expect(submitReview(user.id, product.slug, input)).resolves.toMatchObject({ status: "Pending" });
  });

  it("refuses another customer's review and a review past Pending", async () => {
    const product = await makeProduct();
    const owner = await makeUser();
    const review = await submitReview(owner.id, product.slug, input);

    await expect(withdrawOwnPendingReview((await makeUser()).id, product.slug, review.id)).rejects.toBeInstanceOf(ReviewForbiddenError);

    await changeReviewStatus(review.id, "Approved");
    await expect(withdrawOwnPendingReview(owner.id, product.slug, review.id)).rejects.toBeInstanceOf(ReviewNotEditableError);
  });
});

describe("listPublishedReviews", () => {
  it("returns only Published reviews as public DTOs with pagination metadata", async () => {
    const product = await makeProduct();
    const named = await submitReview((await makeUser("  Nadeesha  ")).id, product.slug, input);
    const anonymous = await submitReview((await makeUser(null)).id, product.slug, { ...input, rating: 5 });
    await submitReview((await makeUser()).id, product.slug, input); // stays Pending
    await publish(named.id);
    await publish(anonymous.id);

    const page = await listPublishedReviews(product.slug, defaultQuery);

    expect(page).toMatchObject({ total: 2, page: 1, pageSize: 10 });
    expect(page.items.map((item) => item.authorName).sort()).toEqual(["Nadeesha", "Oristor customer"]);
    expect(page.items[0]).toEqual({
      id: expect.any(String),
      authorName: expect.any(String),
      rating: expect.any(Number),
      title: input.title,
      body: input.body,
      isVerifiedPurchase: false,
      publishedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it("applies the rating filter and page offsets", async () => {
    const product = await makeProduct();
    for (const rating of [5, 5, 5, 2]) {
      const review = await submitReview((await makeUser()).id, product.slug, { ...input, rating });
      await publish(review.id);
    }

    const page2 = await listPublishedReviews(product.slug, { page: 2, pageSize: 2, sort: "recent", rating: 5 });

    expect(page2.total).toBe(3);
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0]?.rating).toBe(5);
  });

  it("rejects an unpublished product", async () => {
    const draft = await makeProduct("Draft");

    await expect(listPublishedReviews(draft.slug, defaultQuery)).rejects.toBeInstanceOf(ProductNotFoundError);
  });
});
