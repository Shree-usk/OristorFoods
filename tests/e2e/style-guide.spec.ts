import { expect, test } from "@playwright/test";

test("style guide renders all color tokens and type scale steps", async ({ page }) => {
  await page.goto("/style-guide");

  await expect(page.getByRole("heading", { name: "Oristor Style Guide" })).toBeVisible();

  for (const name of [
    "Ivory",
    "Charcoal",
    "Oristor Gold",
    "Chilli Red",
    "Leaf Green",
    "Cream",
    "Warm Beige",
    "Light Gold",
    "Stone Grey",
    "Soft Border",
  ]) {
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }

  for (const step of ["Hero", "H1", "H2", "H3", "H4", "Body", "Small", "Caption"]) {
    await expect(page.getByText(new RegExp(`^${step} / `))).toBeVisible();
  }

  await expect(page.getByRole("button", { name: "Primary CTA (Chilli)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Secondary (Gold)" })).toBeVisible();
});
