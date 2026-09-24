// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import {
  createReview,
  deleteOwnPendingReview,
  findRatingSummary,
  findReviewById,
  findReviewByProductAndUser,
  listPublishedReviews,
  updateOwnPendingReviewContent,
  updateStatusAndRecalculate,
} from "@/repositories/review.repository";

let sequence = 0;

async function makeProduct() {
  sequence += 1;
  return createProduct({ sku: `REV-REPO-${sequence}`, slug: `rev-repo-${sequence}`, name: "Curry Powder", status: "Published" });
}

async function makeUser(name: string | null = "Test Reviewer") {
  sequence += 1;
  return prisma.user.create({ data: { email: `rev-repo-${sequence}@test.com`, name } });
}

async function makeReview(productId: string, rating = 4, name: string | null = "Test Reviewer") {
  const user = await makeUser(name);
  return createReview({
    productId,
    userId: user.id,
    rating,
    title: `Rated ${rating}`,
    body: "A perfectly adequate review body.",
  });
}

async function makePublishedReview(productId: string, rating: number, publishedAt: Date, name = "Test Reviewer") {
  const review = await makeReview(productId, rating, name);
  const updated = await updateStatusAndRecalculate(review.id, productId, "Pending", { status: "Published", publishedAt }, true);
  if (!updated) throw new Error("expected a freshly created Pending review to publish");
  return updated;
}

afterEach(async () => {
  await prisma.productRatingSummary.deleteMany();
  await prisma.review.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
});

describe("review CRUD", () => {
  it("creates a Pending review and finds it by id and by (product, user)", async () => {
    const product = await makeProduct();
    const review = await makeReview(product.id);

    expect(review.status).toBe("Pending");
    expect((await findReviewById(review.id))?.id).toBe(review.id);
    expect((await findReviewByProductAndUser(product.id, review.userId))?.id).toBe(review.id);
  });

  it("enforces one review per customer per product at the database level", async () => {
    const product = await makeProduct();
    const review = await makeReview(product.id);

    await expect(
      createReview({ productId: product.id, userId: review.userId, rating: 2, title: "Again", body: "Trying to review twice here." }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("updates content and deletes when Pending and owned by the caller", async () => {
    const product = await makeProduct();
    const review = await makeReview(product.id);

    const updated = await updateOwnPendingReviewContent(review.id, review.userId, {
      rating: 5,
      title: "Changed",
      body: "A changed and longer review body.",
    });
    expect(updated).toMatchObject({ rating: 5, title: "Changed" });

    expect(await deleteOwnPendingReview(review.id, review.userId)).toBe(true);
    expect(await findReviewById(review.id)).toBeNull();
  });

  it("does nothing when the review is no longer Pending, even for its own author", async () => {
    const product = await makeProduct();
    const review = await makeReview(product.id);
    await updateStatusAndRecalculate(review.id, product.id, "Pending", { status: "Approved" }, false);

    expect(
      await updateOwnPendingReviewContent(review.id, review.userId, { rating: 5, title: "x", body: "Not Pending anymore, so this must not apply." }),
    ).toBeNull();
    expect(await deleteOwnPendingReview(review.id, review.userId)).toBe(false);

    expect(await findReviewById(review.id)).toMatchObject({ status: "Approved", rating: 4, title: "Rated 4" });
  });

  it("does nothing when the userId doesn't match, even while the review is Pending", async () => {
    const product = await makeProduct();
    const review = await makeReview(product.id);
    const other = await makeUser("Someone Else");

    expect(
      await updateOwnPendingReviewContent(review.id, other.id, { rating: 5, title: "x", body: "Wrong user, so this must not apply either." }),
    ).toBeNull();
    expect(await deleteOwnPendingReview(review.id, other.id)).toBe(false);

    expect(await findReviewById(review.id)).toMatchObject({ status: "Pending", rating: 4, title: "Rated 4" });
  });
});

describe("listPublishedReviews", () => {
  it("returns only Published reviews, with the author's name", async () => {
    const product = await makeProduct();
    await makeReview(product.id, 5); // stays Pending
    const rejected = await makeReview(product.id, 1);
    await updateStatusAndRecalculate(rejected.id, product.id, "Pending", { status: "Rejected" }, false);
    await makePublishedReview(product.id, 3, new Date("2026-09-01"), "Nadeesha");

    const result = await listPublishedReviews(product.id, { sort: "recent", skip: 0, take: 10 });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.user.name).toBe("Nadeesha");
  });

  it("sorts by recent, highest and lowest, breaking ties by most recent", async () => {
    const product = await makeProduct();
    const oldFive = await makePublishedReview(product.id, 5, new Date("2026-01-01"));
    const newFive = await makePublishedReview(product.id, 5, new Date("2026-03-01"));
    const midTwo = await makePublishedReview(product.id, 2, new Date("2026-02-01"));

    const ids = async (sort: "recent" | "highest" | "lowest") =>
      (await listPublishedReviews(product.id, { sort, skip: 0, take: 10 })).items.map((item) => item.id);

    expect(await ids("recent")).toEqual([newFive.id, midTwo.id, oldFive.id]);
    expect(await ids("highest")).toEqual([newFive.id, oldFive.id, midTwo.id]);
    expect(await ids("lowest")).toEqual([midTwo.id, newFive.id, oldFive.id]);
  });

  it("filters by rating and paginates, with total reflecting the filter", async () => {
    const product = await makeProduct();
    for (let day = 1; day <= 3; day += 1) {
      await makePublishedReview(product.id, 5, new Date(`2026-05-0${day}`));
    }
    await makePublishedReview(product.id, 1, new Date("2026-05-09"));

    const firstPage = await listPublishedReviews(product.id, { sort: "recent", rating: 5, skip: 0, take: 2 });
    const secondPage = await listPublishedReviews(product.id, { sort: "recent", rating: 5, skip: 2, take: 2 });

    expect(firstPage.total).toBe(3);
    expect(firstPage.items).toHaveLength(2);
    expect(secondPage.items).toHaveLength(1);
    expect([...firstPage.items, ...secondPage.items].every((item) => item.rating === 5)).toBe(true);
  });
});

describe("updateStatusAndRecalculate", () => {
  it("creates the rating summary when the first review is published", async () => {
    const product = await makeProduct();
    await makePublishedReview(product.id, 4, new Date());

    const summary = await findRatingSummary(product.id);

    expect(summary?.reviewCount).toBe(1);
    expect(summary?.averageRating.toFixed(2)).toBe("4.00");
    expect(summary).toMatchObject({ count1: 0, count2: 0, count3: 0, count4: 1, count5: 0 });
  });

  it("recalculates the average and histogram as more reviews are published", async () => {
    const product = await makeProduct();
    await makePublishedReview(product.id, 5, new Date());
    await makePublishedReview(product.id, 4, new Date());
    await makePublishedReview(product.id, 4, new Date());

    const summary = await findRatingSummary(product.id);

    expect(summary?.reviewCount).toBe(3);
    expect(summary?.averageRating.toFixed(2)).toBe("4.33");
    expect(summary).toMatchObject({ count4: 2, count5: 1 });
  });

  it("recalculates when a review leaves Published, and deletes the row when none remain", async () => {
    const product = await makeProduct();
    const five = await makePublishedReview(product.id, 5, new Date());
    const three = await makePublishedReview(product.id, 3, new Date());

    await updateStatusAndRecalculate(five.id, product.id, "Published", { status: "Archived" }, true);
    expect(await findRatingSummary(product.id)).toMatchObject({ reviewCount: 1, count3: 1, count5: 0 });

    await updateStatusAndRecalculate(three.id, product.id, "Published", { status: "Archived" }, true);
    expect(await findRatingSummary(product.id)).toBeNull();
  });

  it("returns null and changes nothing when fromStatus doesn't match the review's current status", async () => {
    const product = await makeProduct();
    const review = await makeReview(product.id, 4); // status is Pending

    const result = await updateStatusAndRecalculate(review.id, product.id, "Approved", { status: "Published", publishedAt: new Date() }, true);

    expect(result).toBeNull();
    expect(await findReviewById(review.id)).toMatchObject({ status: "Pending" });
    expect(await findRatingSummary(product.id)).toBeNull();
  });

  it("leaves the summary untouched when recalculate is false", async () => {
    const product = await makeProduct();
    await makePublishedReview(product.id, 5, new Date());
    const pending = await makeReview(product.id, 1);

    await updateStatusAndRecalculate(pending.id, product.id, "Pending", { status: "Approved" }, false);

    expect(await findRatingSummary(product.id)).toMatchObject({ reviewCount: 1, count5: 1 });
  });
});
