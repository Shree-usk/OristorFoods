import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { prisma } from "@/lib/db";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { createProduct } from "@/repositories/product.repository";
import { advanceQuestionToPublished, submitQuestion } from "@/services/qa.service";

import { signInAs } from "./helpers/auth";

const SKU_PREFIX = "E2E-QA-";
const EMAIL_DOMAIN = "@e2e-qa.test";

async function seedProduct(n: number, name: string) {
  const product = await createProduct({ sku: `${SKU_PREFIX}${n}`, slug: `e2e-qa-${n}`, name, status: "Published" });
  await createStandardPrice({ product: { connect: { id: product.id } }, price: "450.00" });
  return product;
}

async function seedUser(label: string) {
  return prisma.user.create({ data: { email: `${label}${EMAIL_DOMAIN}`, name: label } });
}

async function seedPublishedQa(productSlug: string, userId: string, text: string, answer: string) {
  const question = await submitQuestion(userId, productSlug, { text });
  await advanceQuestionToPublished(question.id, answer);
}

test.describe("Product Q&A", () => {
  // The tests share SKU/email prefixes cleaned up in beforeEach.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    // Questions cascade with their product and user.
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  });

  test("a submitted question stays private but shows as awaiting an answer", async ({ page }) => {
    const product = await seedProduct(1, "E2E QA Cinnamon");
    const user = await seedUser("asker");
    await signInAs(page, user.id);

    await page.goto(`/products/${product.slug}`);
    await page.getByLabel("Your question").fill("Is this cinnamon Ceylon or cassia?");
    await page.getByRole("button", { name: "Submit question" }).click();
    await expect(page.getByText("Thanks! Your question was submitted and is pending review.")).toBeVisible();

    await page.reload();
    const section = page.locator('section[aria-labelledby="questions-heading"]');
    await expect(section.getByText("No questions yet.")).toBeVisible();
    await expect(section.getByRole("heading", { name: "Is this cinnamon Ceylon or cassia?" })).toHaveCount(0);
    await expect(section.getByRole("heading", { name: "Your questions awaiting an answer" })).toBeVisible();
    await expect(section.getByText("Is this cinnamon Ceylon or cassia?")).toBeVisible();
  });

  test("published Q&A renders and the search filters it", async ({ page }) => {
    const product = await seedProduct(2, "E2E QA Pepper");
    const asker = await seedUser("reader");
    await seedPublishedQa(product.slug, asker.id, "How should I store the peppercorns?", "In an airtight jar away from light.");
    await seedPublishedQa(product.slug, asker.id, "Are these peppercorns organic?", "Yes, certified organic.");

    await page.goto(`/products/${product.slug}`);
    const section = page.locator('section[aria-labelledby="questions-heading"]');
    await expect(section.getByRole("heading", { name: "How should I store the peppercorns?" })).toBeVisible();
    await expect(section.getByText("In an airtight jar away from light.")).toBeVisible();

    await section.getByLabel("Search questions about this product").fill("organic");
    await expect(section.getByRole("heading", { name: "How should I store the peppercorns?" })).toHaveCount(0);
    await expect(section.getByRole("heading", { name: "Are these peppercorns organic?" })).toBeVisible();

    await section.getByLabel("Search questions about this product").fill("delivery");
    await expect(section.getByText("No questions match “delivery”. Ask it below.")).toBeVisible();
  });

  test("the Q&A section has no detectable accessibility violations", async ({ page }) => {
    const product = await seedProduct(3, "E2E QA Cloves");
    const user = await seedUser("a11y");
    await seedPublishedQa(product.slug, user.id, "Are the cloves whole or ground?", "Whole, hand-picked cloves.");
    await signInAs(page, user.id);

    await page.goto(`/products/${product.slug}`);
    await expect(page.getByRole("button", { name: "Submit question" })).toBeVisible();

    const results = await new AxeBuilder({ page }).include('section[aria-labelledby="questions-heading"]').analyze();
    expect(results.violations).toEqual([]);
  });
});
