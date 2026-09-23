import { test, expect } from "@playwright/test";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";

test.describe.configure({ mode: "serial" });

test.describe("Product Compare", () => {
  // Scoped to this spec's SKUs (StandardPrice rows cascade on product
  // delete) so it doesn't wipe catalogue data other e2e specs rely on.
  test.beforeEach(async () => {
    await prisma.product.deleteMany({ where: { sku: { startsWith: "E2E-COMPARE-" } } });
  });

  test("adds 3 products from the listing grid, compares them, then removes one", async ({ page }) => {
    for (const [i, name] of ["Curry Powder", "Chili Paste", "Turmeric Powder"].entries()) {
      const product = await createProduct({
        sku: `E2E-COMPARE-${i + 1}`,
        slug: `e2e-compare-${i + 1}`,
        name,
        status: "Published",
      });
      await createStandardPrice({ product: { connect: { id: product.id } }, price: "300.00" });
    }

    await page.goto("/products");
    const cards = page.locator('[aria-label="Add to compare"]');
    await cards.nth(0).click();
    await cards.nth(0).click();
    await cards.nth(0).click();

    await page.getByRole("button", { name: /compare, 3 items/i }).click();
    // Rendered as <Button render={<Link/>}>, which Base UI exposes as role="button".
    await page.getByRole("menu").getByRole("button", { name: "Compare", exact: true }).click();

    await expect(page).toHaveURL(/\/products\/compare\?ids=/);
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();

    // Scoped to the table: the header tray menu has same-named Remove buttons.
    const removeButtons = page.getByRole("table").getByRole("button", { name: /^Remove /i });
    await removeButtons.first().click();

    await expect(page.locator("table thead th")).toHaveCount(3); // 1 label column + 2 remaining products
  });

  test("adding a 5th product to a full tray is blocked with an inline message", async ({ page }) => {
    for (let i = 1; i <= 5; i++) {
      const product = await createProduct({
        sku: `E2E-COMPARE-${i}`,
        slug: `e2e-compare-full-${i}`,
        name: `Product ${i}`,
        status: "Published",
      });
      await createStandardPrice({ product: { connect: { id: product.id } }, price: "300.00" });
    }

    await page.goto("/products");
    const toggles = page.locator('[aria-label="Add to compare"]');
    for (let i = 0; i < 4; i++) {
      await toggles.nth(0).click();
    }

    await toggles.nth(0).click();

    await expect(page.getByText(/compare is full/i)).toBeVisible();
  });
});
