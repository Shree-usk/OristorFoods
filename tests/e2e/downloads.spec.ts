import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/db";

const CATEGORY_SLUG_PREFIX = "e2e-downloads-";
const RESOURCE_SLUG_PREFIX = "e2e-downloads-";

async function seedCategory(n: number, name: string) {
  return prisma.downloadCategory.create({ data: { name, slug: `${CATEGORY_SLUG_PREFIX}${n}`, sortOrder: n } });
}

async function seedResource(n: number, categoryId: string, title: string) {
  return prisma.downloadResource.create({
    data: {
      slug: `${RESOURCE_SLUG_PREFIX}${n}`,
      title,
      thumbnailUrl: "/images/products/export/curry-powder.webp",
      // Reuses a real seeded file (Task 9) rather than a fabricated path —
      // the "downloading succeeds" test below needs an actual file on disk
      // to get a 200, not the graceful-404 path.
      fileUrl: "/downloads/understanding-nutrition-labels.pdf",
      fileType: "PDF",
      fileSizeBytes: 204_800,
      categoryId,
      status: "Published",
    },
  });
}

test.describe("Downloads & Resources", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.downloadResource.deleteMany({ where: { slug: { startsWith: RESOURCE_SLUG_PREFIX } } });
    await prisma.downloadCategory.deleteMany({ where: { slug: { startsWith: CATEGORY_SLUG_PREFIX } } });
  });

  test("browsing /downloads shows resources, filterable by category", async ({ page }) => {
    const categoryA = await seedCategory(1, "E2E Guides");
    const categoryB = await seedCategory(2, "E2E Brand");
    await seedResource(1, categoryA.id, "E2E Guide Resource");
    await seedResource(2, categoryB.id, "E2E Brand Resource");

    await page.goto("/downloads");
    await expect(page.getByText("E2E Guide Resource")).toBeVisible();
    await expect(page.getByText("E2E Brand Resource")).toBeVisible();

    await page.getByRole("link", { name: "E2E Guides" }).click();
    await expect(page).toHaveURL(/category=e2e-downloads-1/);
    await expect(page.getByText("E2E Guide Resource")).toBeVisible();
    await expect(page.getByText("E2E Brand Resource")).not.toBeVisible();
  });

  test("downloading a resource succeeds and its listed count increases on reload", async ({ page }) => {
    const category = await seedCategory(3, "E2E Count Category");
    const resource = await seedResource(3, category.id, "E2E Count Resource");

    const response = await page.request.get(`/api/downloads/${resource.slug}/file`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-disposition"]).toContain("attachment");

    const refreshed = await prisma.downloadResource.findUniqueOrThrow({ where: { id: resource.id } });
    expect(refreshed.downloadCount).toBe(1);
  });

  test("the downloads grid has no detectable accessibility violations", async ({ page }) => {
    const category = await seedCategory(4, "E2E A11y Category");
    await seedResource(4, category.id, "E2E A11y Resource");

    await page.goto("/downloads");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
