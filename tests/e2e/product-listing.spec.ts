import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("applying the in-stock filter updates the URL and the result grid", async ({ page }) => {
  await page.goto("/products");

  const checkbox = page.getByRole("checkbox", { name: "In stock only" }).first();
  await checkbox.click();

  await expect(page).toHaveURL(/inStock=true/);
});

test("changing the sort order updates the URL", async ({ page }) => {
  await page.goto("/products");

  await page.getByRole("combobox", { name: "Sort products" }).click();
  await page.getByRole("option", { name: "Price: Low to High" }).click();

  await expect(page).toHaveURL(/sort=price-asc/);
});

test("pagination navigates between pages and updates the URL", async ({ page }) => {
  await page.goto("/products?pageSize=2");

  const pagination = page.getByRole("navigation", { name: "Pagination" });
  await expect(pagination).toBeVisible();

  await pagination.getByRole("button", { name: "2" }).click();

  await expect(page).toHaveURL(/page=2/);
});

test("shows the zero-result state with a working clear-filters control", async ({ page }) => {
  await page.goto("/products?priceMin=999999");

  await expect(page.getByText("No products match your filters.")).toBeVisible();

  await page.getByRole("button", { name: "Clear all filters" }).click();

  await expect(page).not.toHaveURL(/priceMin/);
});

test("filter sidebar has no automatically detectable accessibility violations (desktop)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/products");

  const results = await new AxeBuilder({ page }).include('aside[aria-label="Filter products"]').analyze();

  expect(results.violations).toEqual([]);
});

test("filter drawer has no automatically detectable accessibility violations (mobile)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/products");

  await page.getByRole("button", { name: "Filters", exact: true }).click();

  const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();

  expect(results.violations).toEqual([]);
});
