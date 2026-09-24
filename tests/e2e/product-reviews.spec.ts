import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { prisma } from "@/lib/db";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { createProduct } from "@/repositories/product.repository";
import { advanceReviewToPublished, submitReview } from "@/services/review.service";

import { signInAs } from "./helpers/auth";

const SKU_PREFIX = "E2E-REVIEW-";
const EMAIL_DOMAIN = "@e2e-review.test";
const reviewBody = "Plenty of flavour and a clean, bright heat.";

async function seedProduct(n: number, name: string) {
  const product = await createProduct({ sku: `${SKU_PREFIX}${n}`, slug: `e2e-review-${n}`, name, status: "Published" });
  await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });
  return product;
}

async function seedUser(label: string, name: string) {
  return prisma.user.create({ data: { email: `${label}${EMAIL_DOMAIN}`, name } });
}

async function seedPublishedReview(productSlug: string, userId: string, rating: number, title: string) {
  const review = await submitReview(userId, productSlug, { rating, title, body: reviewBody });
  await advanceReviewToPublished(review.id);
}

test.describe("Product reviews", () => {
  // Both tests clean up the same SKU/email prefixes in beforeEach.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    // Reviews and rating summaries cascade with their product and user.
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  });

  test("a submitted review stays private until it is published", async ({ page }) => {
    const product = await seedProduct(1, "E2E Review Curry");
    const user = await seedUser("writer", "Asha W.");
    await signInAs(page, user.id);

    await page.goto(`/products/${product.slug}`);
    await page.getByRole("radio", { name: "4 stars" }).check({ force: true });
    await page.getByLabel("Title").fill("Rich and aromatic");
    await page.getByLabel("Your review").fill("Toasted notes come through nicely in a dhal.");
    await page.getByRole("button", { name: "Submit review" }).click();

    await expect(page.getByText("Thanks! Your review is pending approval.")).toBeVisible();

    await page.reload();
    const reviews = page.locator('section[aria-labelledby="reviews-heading"]');
    await expect(reviews.getByText("No reviews yet.")).toBeVisible();
    await expect(reviews.getByRole("heading", { name: "Rich and aromatic" })).toHaveCount(0);
  });

  test("published reviews show on the product page and in compare", async ({ page }) => {
    const reviewed = await seedProduct(2, "E2E Reviewed Chilli");
    const other = await seedProduct(3, "E2E Unreviewed Pepper");
    await seedPublishedReview(reviewed.slug, (await seedUser("a", "Nimal S.")).id, 5, "Fiery and fresh");
    await seedPublishedReview(reviewed.slug, (await seedUser("b", "Ruwani D.")).id, 4, "Good everyday chilli");

    await page.goto(`/products/${reviewed.slug}`);
    const reviews = page.locator('section[aria-labelledby="reviews-heading"]');
    await expect(reviews.getByText("Based on 2 reviews")).toBeVisible();
    await expect(reviews.getByRole("img", { name: "4.5 out of 5 stars" })).toBeVisible();
    await expect(reviews.getByRole("heading", { name: "Fiery and fresh" })).toBeVisible();
    await expect(reviews.getByRole("heading", { name: "Good everyday chilli" })).toBeVisible();

    await reviews.getByRole("button", { name: "Show 5-star reviews (1)" }).click();
    await expect(reviews.getByRole("heading", { name: "Good everyday chilli" })).toHaveCount(0);
    await expect(reviews.getByRole("heading", { name: "Fiery and fresh" })).toBeVisible();

    await page.goto(`/products/compare?ids=${reviewed.id},${other.id}`);
    await expect(page.getByText("4.5 (2)")).toBeVisible();
  });

  test("the reviews section has no detectable accessibility violations", async ({ page }) => {
    const product = await seedProduct(4, "E2E Accessible Turmeric");
    await seedPublishedReview(product.slug, (await seedUser("c", "Dilani K.")).id, 5, "Golden and earthy");
    await signInAs(page, (await seedUser("d", "Sunil J.")).id);

    await page.goto(`/products/${product.slug}`);
    await expect(page.getByRole("button", { name: "Submit review" })).toBeVisible();

    const results = await new AxeBuilder({ page }).include('section[aria-labelledby="reviews-heading"]').analyze();
    expect(results.violations).toEqual([]);
  });
});
