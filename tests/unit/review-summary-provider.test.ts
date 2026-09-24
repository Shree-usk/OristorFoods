// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { createProduct } from "@/repositories/product.repository";
import { resetProductDetailExtensionsForTesting } from "@/services/product-detail-extensions";
import { getProductDetail } from "@/services/product.service";
import {
  changeReviewStatus,
  getReviewSummaryForProduct,
  registerReviewProviders,
  submitReview,
} from "@/services/review.service";

let sequence = 0;

async function makeProduct() {
  sequence += 1;
  const product = await createProduct({ sku: `REV-PROV-${sequence}`, slug: `rev-prov-${sequence}`, name: "Gift Set", status: "Published" });
  await createStandardPrice({ product: { connect: { id: product.id } }, price: "2500.00" });
  return product;
}

async function publishedReview(productSlug: string, rating: number, name: string) {
  sequence += 1;
  const user = await prisma.user.create({ data: { email: `rev-prov-${sequence}@test.com`, name } });
  const review = await submitReview(user.id, productSlug, { rating, title: `${rating} stars`, body: "Beautifully packed and very fresh spices." });
  await changeReviewStatus(review.id, "Approved");
  await changeReviewStatus(review.id, "Published");
}

afterEach(async () => {
  resetProductDetailExtensionsForTesting();
  await prisma.productRatingSummary.deleteMany();
  await prisma.review.deleteMany();
  await prisma.standardPrice.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
});

describe("getReviewSummaryForProduct", () => {
  it("returns null when the product has no Published reviews", async () => {
    const product = await makeProduct();

    expect(await getReviewSummaryForProduct(product.id)).toBeNull();
  });

  it("returns the aggregate, histogram and the first page of reviews", async () => {
    const product = await makeProduct();
    await publishedReview(product.slug, 5, "Nadeesha");
    await publishedReview(product.slug, 4, "Kamal");

    const summary = await getReviewSummaryForProduct(product.id);

    expect(summary).toMatchObject({
      averageRating: 4.5,
      reviewCount: 2,
      histogram: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
    });
    // Both were published within the same test, possibly in the same
    // millisecond, so assert membership rather than order.
    expect(summary?.previewReviews.map((review) => review.authorName).sort()).toEqual(["Kamal", "Nadeesha"]);
  });
});

describe("registerReviewProviders", () => {
  it("makes getProductDetail include real review data", async () => {
    const product = await makeProduct();
    await publishedReview(product.slug, 3, "Ruwani");

    registerReviewProviders();
    const detail = await getProductDetail(product.slug);

    expect(detail?.reviewSummary).toMatchObject({ averageRating: 3, reviewCount: 1 });
  });
});

describe("provider registry", () => {
  it("is shared across separately loaded copies of the extensions module", async () => {
    // Next.js bundles src/instrumentation.ts separately from route code, so
    // the module that registers a provider is not the same module instance
    // that reads it. The registry lives on globalThis to survive that.
    const first = await import("@/services/product-detail-extensions");
    vi.resetModules();
    const second = await import("@/services/product-detail-extensions");
    expect(second).not.toBe(first);

    first.registerReviewSummaryProvider(async () => ({ averageRating: 2, reviewCount: 1, histogram: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 0 }, previewReviews: [] }));

    expect((await second.getReviewSummary("any"))?.averageRating).toBe(2);
  });
});
