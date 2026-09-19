import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("renders every required PDP section for a seeded product", async ({ page }) => {
  await page.goto("/products/roasted-curry-powder-100g");

  await expect(page.getByRole("heading", { level: 1, name: "Roasted Curry Powder 100g" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
  await expect(page.getByText("Nutrition Facts")).toBeVisible();
  await expect(page.getByText("Coriander")).toBeVisible();
  await expect(page.getByText("Benefits")).toBeVisible();
  await expect(page.getByText("Serving Suggestions")).toBeVisible();
  await expect(page.getByText(/Earn \d+ reward points/)).toBeVisible();
  await expect(page.getByText("Recipes for this product are coming soon.")).toBeVisible();
  await expect(page.getByText("No reviews yet.")).toBeVisible();
  await expect(page.getByText("No questions yet.")).toBeVisible();
});

test("opens and closes the image gallery lightbox", async ({ page }) => {
  await page.goto("/products/roasted-curry-powder-100g");

  await page.getByRole("button", { name: /Zoom in on/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("shows a disabled Add to Cart control until the Shopping Cart story ships", async ({ page }) => {
  await page.goto("/products/roasted-curry-powder-100g");

  await expect(page.getByRole("button", { name: "Add to Cart" })).toBeDisabled();
});

test("product detail page has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/products/roasted-curry-powder-100g");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
