import { expect, test } from "@playwright/test";

// Depends on prisma/seed-recipes.ts: sri-lankan-chicken-curry (Youtube),
// dhal-curry-parippu (Vimeo) and chicken-kottu-roti (SelfHosted) are the
// three Published, video-tagged recipes (videoUrl/videoProvider set).
// Sorted "newest" (the /recipes default, by publishedAt desc) they are:
// Chicken Kottu Roti (2026-09-18), Sri Lankan Chicken Curry (2026-07-15),
// Dhal Curry (Parippu) (2026-06-30). coconut-sambol-maldive-fish is
// Published with no videoUrl, heroImageAlt "Oristor Maldive fish flakes,
// used in this recipe".

test("a video recipe's detail page shows a Play video button with no iframe until clicked, then mounts the iframe", async ({ page }) => {
  await page.goto("/recipes/sri-lankan-chicken-curry");

  const playButton = page.getByRole("button", { name: "Play video" });
  await expect(playButton).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);

  await playButton.click();

  await expect(page.locator("iframe")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Play video" })).toHaveCount(0);
});

test("/recipes?hasVideo=true lists only video recipes, each showing the video badge", async ({ page }) => {
  await page.goto("/recipes?hasVideo=true");

  const results = page.getByRole("region", { name: "Recipe results" });
  await expect(results.locator("article h3")).toHaveText(["Chicken Kottu Roti", "Sri Lankan Chicken Curry", "Dhal Curry (Parippu)"]);
  await expect(results.locator('[aria-label="Video available"]')).toHaveCount(3);
});

test("a non-video recipe's detail page shows the static hero image and no play button", async ({ page }) => {
  await page.goto("/recipes/coconut-sambol-maldive-fish");

  await expect(page.getByRole("img", { name: "Oristor Maldive fish flakes, used in this recipe" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play video" })).toHaveCount(0);
  await expect(page.locator("iframe")).toHaveCount(0);
});
