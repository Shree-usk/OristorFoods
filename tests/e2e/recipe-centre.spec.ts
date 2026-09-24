import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Depends on prisma/seed-recipes.ts: 16 Published recipes (12 per page), plus
// one Draft and one Archived that must never appear.

function resultTitles(page: Page) {
  return page.getByRole("region", { name: "Recipe results" }).locator("article h3");
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("renders the first page of recipes on the server", async ({ page }) => {
    const response = await page.request.get("/recipes");
    const html = await response.text();

    expect(response.status()).toBe(200);
    expect(html).toContain("Chicken Kottu Roti");
    expect(html).not.toContain("Pumpkin Curry");
    expect(html).not.toContain("Milk Toffee");
  });

  test("combines category, difficulty and dietary filters in the URL, and Back restores them", async ({ page }) => {
    await page.goto("/recipes");
    await expect(page.getByRole("heading", { level: 1, name: "Recipe Centre" })).toBeVisible();
    await expect(page.getByText("16 recipes")).toBeVisible();

    await page.getByRole("navigation", { name: "Recipe categories" }).getByRole("link", { name: "Curries" }).click();
    await expect(page).toHaveURL(/category=curries/);

    const sidebar = page.getByRole("complementary", { name: "Filter recipes" });
    await sidebar.getByRole("checkbox", { name: "Medium" }).click();
    await expect(page).toHaveURL(/difficulty=medium/);
    await sidebar.getByRole("checkbox", { name: "Spicy" }).click();
    await expect(page).toHaveURL(/diet=spicy/);

    await expect(resultTitles(page)).toHaveText(["Chili Paste Deviled Prawns", "Sri Lankan Chicken Curry"]);

    // Back undoes one filter at a time: first Spicy, then Medium.
    await page.goBack();
    await expect(page).not.toHaveURL(/diet=spicy/);
    await expect(page).toHaveURL(/difficulty=medium/);

    await page.goBack();
    await expect(page).not.toHaveURL(/difficulty=/);
    await expect(page).toHaveURL(/category=curries/);
    await expect(resultTitles(page)).toHaveText([
      "Chili Paste Deviled Prawns",
      "Fish Ambul Thiyal",
      "Sri Lankan Chicken Curry",
      "Dhal Curry (Parippu)",
    ]);
  });

  test("shows the empty state for a zero-result combination and clears it", async ({ page }) => {
    await page.goto("/recipes?category=beverages&diet=spicy");

    await expect(page.getByText("No recipes match those filters.")).toBeVisible();
    await page.getByRole("button", { name: "Clear all filters" }).click();

    await expect(page).not.toHaveURL(/category=|diet=/);
    await expect(page.getByText("16 recipes")).toBeVisible();
    await expect(resultTitles(page)).toHaveCount(12);
  });

  test("sorting by cook time orders cards by total time", async ({ page }) => {
    await page.goto("/recipes");

    await page.getByRole("combobox", { name: "Sort recipes" }).click();
    await page.getByRole("option", { name: "Cook Time (shortest first)" }).click();
    await expect(page).toHaveURL(/sort=time/);

    const api = (await (await page.request.get("/api/recipes?sort=time")).json()) as {
      recipes: Array<{ title: string; totalTimeMinutes: number }>;
    };
    const times = api.recipes.map((recipe) => recipe.totalTimeMinutes);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    await expect(resultTitles(page)).toHaveText(api.recipes.map((recipe) => recipe.title));
  });

  test("search filters by title", async ({ page }) => {
    await page.goto("/recipes");

    await page.getByRole("searchbox", { name: "Search recipes" }).fill("sambol");

    await expect(page).toHaveURL(/q=sambol/);
    await expect(resultTitles(page)).toHaveText(["Coconut Sambol with Maldive Fish", "Seeni Sambol"]);
  });

  test("the Quick & Easy menu link lands on easy recipes under 30 minutes", async ({ page }) => {
    await page.goto("/");

    await page.locator("header").getByRole("button", { name: "Recipes" }).click();
    await page.getByRole("link", { name: "Quick & Easy" }).click();

    await expect(page).toHaveURL(/\/recipes\?difficulty=easy&time=under-15(,|%2C)15-30/);
    await expect(page.getByRole("complementary", { name: "Filter recipes" }).getByRole("checkbox", { name: "Easy" })).toBeChecked();
    await expect(resultTitles(page)).toHaveText([
      "Pol Roti with Lunu Miris",
      "Coconut Sambol with Maldive Fish",
      "Sri Lankan Ginger Tea",
      "Wood Apple Juice",
    ]);
  });

  test("pagination moves to page 2", async ({ page }) => {
    await page.goto("/recipes");

    await page.getByRole("navigation", { name: "Pagination" }).getByRole("button", { name: "2" }).click();

    await expect(page).toHaveURL(/page=2/);
    await expect(resultTitles(page)).toHaveText(["Watalappan", "Kiribath (Milk Rice)", "Sri Lankan Ginger Tea", "Wood Apple Juice"]);
  });

  test("filter sidebar and category chips have no detectable accessibility violations", async ({ page }) => {
    await page.goto("/recipes");
    await expect(resultTitles(page)).toHaveCount(12);

    const results = await new AxeBuilder({ page })
      .include('aside[aria-label="Filter recipes"]')
      .include('nav[aria-label="Recipe categories"]')
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("homepage shows four featured recipes linking into the Recipe Centre", async ({ page }) => {
    await page.goto("/");

    const section = page.locator("section", { has: page.getByRole("heading", { level: 2, name: "Featured Recipes" }) });
    const links = section.locator("article h3 a");
    await expect(links).toHaveCount(4);
    for (const href of await links.evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href")))) {
      expect(href).toMatch(/^\/recipes\/[a-z0-9-]+$/);
    }
    await expect(section.getByText("Pumpkin Curry")).toHaveCount(0);
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("the filter drawer applies a dietary filter and has no detectable accessibility violations", async ({ page }) => {
    await page.goto("/recipes");

    await page.getByRole("button", { name: "Filters", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    expect(results.violations).toEqual([]);

    await dialog.getByRole("checkbox", { name: "Vegan" }).click();
    await dialog.getByRole("button", { name: "Apply" }).click();

    await expect(page).toHaveURL(/diet=vegan/);
    await expect(page.getByText("7 recipes")).toBeVisible();
  });
});
