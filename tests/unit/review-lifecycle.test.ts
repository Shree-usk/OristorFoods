// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { ReviewStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createReview, findReviewById } from "@/repositories/review.repository";
import { InvalidReviewTransitionError, ReviewNotFoundError } from "@/services/review.errors";
import { advanceReviewToPublished, canTransitionReview, changeReviewStatus, getRatingSummary } from "@/services/review.service";

let sequence = 0;

async function makePendingReview(rating = 4) {
  sequence += 1;
  const product = await createProduct({ sku: `REV-LIFE-${sequence}`, slug: `rev-life-${sequence}`, name: "Chilli Powder", status: "Published" });
  const user = await prisma.user.create({ data: { email: `rev-life-${sequence}@test.com`, name: "Reviewer" } });
  return createReview({ productId: product.id, userId: user.id, rating, title: "Nice heat", body: "Balanced heat with a lovely colour." });
}

afterEach(async () => {
  await prisma.productRatingSummary.deleteMany();
  await prisma.review.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
});

const statuses: ReviewStatus[] = ["Pending", "Approved", "Published", "Rejected", "Archived"];
const allowed = new Set([
  "Pending>Approved",
  "Pending>Rejected",
  "Approved>Published",
  "Approved>Rejected",
  "Published>Archived",
  "Archived>Published",
]);

describe("canTransitionReview", () => {
  const pairs = statuses.flatMap((from) => statuses.map((to) => [from, to] as const));

  it.each(pairs)("%s -> %s matches the blueprint workflow", (from, to) => {
    expect(canTransitionReview(from, to)).toBe(allowed.has(`${from}>${to}`));
  });
});

describe("changeReviewStatus", () => {
  it("throws ReviewNotFoundError for an unknown review", async () => {
    await expect(changeReviewStatus("missing-id", "Approved")).rejects.toBeInstanceOf(ReviewNotFoundError);
  });

  it("rejects a transition the workflow doesn't allow", async () => {
    const review = await makePendingReview();

    await expect(changeReviewStatus(review.id, "Published")).rejects.toBeInstanceOf(InvalidReviewTransitionError);
    expect((await findReviewById(review.id))?.status).toBe("Pending");
  });

  it("does not create a summary for a transition that doesn't touch Published", async () => {
    const review = await makePendingReview();

    await changeReviewStatus(review.id, "Approved");

    expect(await getRatingSummary(review.productId)).toBeNull();
  });

  it("sets publishedAt and builds the summary on entering Published", async () => {
    const review = await makePendingReview(4);
    await changeReviewStatus(review.id, "Approved");

    const published = await changeReviewStatus(review.id, "Published");

    expect(published.status).toBe("Published");
    expect(published.publishedAt).toBeInstanceOf(Date);
    expect(await getRatingSummary(review.productId)).toEqual({
      averageRating: 4,
      reviewCount: 1,
      histogram: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 },
    });
  });

  it("removes the review from the summary when archived, and restores it when re-published", async () => {
    const review = await makePendingReview(5);
    await changeReviewStatus(review.id, "Approved");
    await changeReviewStatus(review.id, "Published");

    await changeReviewStatus(review.id, "Archived");
    expect(await getRatingSummary(review.productId)).toBeNull();

    await changeReviewStatus(review.id, "Published");
    expect((await getRatingSummary(review.productId))?.reviewCount).toBe(1);
  });

  it("writes moderator fields only when they are provided", async () => {
    const review = await makePendingReview();
    const moderator = await prisma.user.create({ data: { email: "moderator@test.com", name: "Moderator" } });

    const approved = await changeReviewStatus(review.id, "Approved");
    expect(approved).toMatchObject({ reviewedById: null, reviewedAt: null, moderatorNote: null });

    const rejected = await changeReviewStatus(review.id, "Rejected", { moderatorId: moderator.id, note: "Off-topic" });
    expect(rejected.reviewedById).toBe(moderator.id);
    expect(rejected.reviewedAt).toBeInstanceOf(Date);
    expect(rejected.moderatorNote).toBe("Off-topic");
  });
});

describe("advanceReviewToPublished", () => {
  it("walks a Pending review through Approved to Published", async () => {
    const review = await makePendingReview(5);

    const published = await advanceReviewToPublished(review.id);

    expect(published.status).toBe("Published");
    expect((await getRatingSummary(review.productId))?.reviewCount).toBe(1);
  });

  it("republishes an Archived review and leaves a Published one as it is", async () => {
    const review = await makePendingReview();
    await advanceReviewToPublished(review.id);
    await changeReviewStatus(review.id, "Archived");

    expect((await advanceReviewToPublished(review.id)).status).toBe("Published");
    expect((await advanceReviewToPublished(review.id)).status).toBe("Published");
  });

  it("refuses a Rejected review", async () => {
    const review = await makePendingReview();
    await changeReviewStatus(review.id, "Rejected");

    await expect(advanceReviewToPublished(review.id)).rejects.toBeInstanceOf(InvalidReviewTransitionError);
  });
});
