import { expect, test } from "@playwright/test";

const viewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
];

for (const viewport of viewports) {
  test(`no horizontal overflow at ${viewport.name} (${viewport.width}px)`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
}

test("container respects the max-width at desktop width", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");

  // Scope to the homepage's own (default-size) container, not the
  // header's — the header uses Container size="wide" (max-w-[100rem]),
  // which is a different, intentionally wider budget (STORY-004).
  const container = page.locator('main [data-slot="container"]').first();
  const box = await container.boundingBox();
  expect(box).not.toBeNull();
  // max-w-7xl = 80rem = 1280px
  expect(box!.width).toBeLessThanOrEqual(1280);
});

test("main landmark exists exactly once", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator("#main-content")).toHaveCount(1);
});
