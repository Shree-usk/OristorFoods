import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-admin-seo-pages.test";
const ROLE_KEY_PREFIX = "e2e-admin-seo-pages-role-";
const SKU_PREFIX = "E2E-SEO-PAGES-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin SEO Pages Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "E2E Admin", passwordHash, roleId: role.id } });
}

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("Admin SEO Pages — bulk editing + health scoring (STORY-051d)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    const productIds = await prisma.product.findMany({ where: { sku: { startsWith: SKU_PREFIX } }, select: { id: true } }).then((rows) => rows.map((r) => r.id));
    await prisma.seoMeta.deleteMany({ where: { entityId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
    await prisma.mediaAsset.deleteMany({ where: { originalName: { startsWith: "e2e-seo-pages-" } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test("the central list shows real pages, filtering narrows them, a bulk title template updates the selected ones, and a too-small OG image shows the new health warning", async ({ page }) => {
    test.setTimeout(60_000);

    const admin = await makeAdminUser([
      { module: "SEO", action: "View" },
      { module: "SEO", action: "Edit" },
      { module: "Products", action: "View" },
      { module: "Products", action: "Edit" },
      { module: "Recipes", action: "View" },
      { module: "Blog", action: "View" },
      { module: "MediaLibrary", action: "View" },
    ]);

    sequence += 1;
    const incomplete = await prisma.product.create({ data: { sku: `${SKU_PREFIX}${sequence}`, slug: `e2e-seo-pages-incomplete-${sequence}`, name: `E2E SEO Pages Incomplete ${sequence}`, status: "Published" } });

    sequence += 1;
    const complete = await prisma.product.create({ data: { sku: `${SKU_PREFIX}${sequence}`, slug: `e2e-seo-pages-complete-${sequence}`, name: `E2E SEO Pages Complete ${sequence}`, status: "Published" } });
    await prisma.seoMeta.create({
      data: {
        entityType: "Product",
        entityId: complete.id,
        metaTitle: "A".repeat(55),
        metaDescription: "A fully-formed description for this already-complete page.",
        canonicalUrl: `https://oristor.com/products/${complete.slug}`,
      },
    });

    const smallAsset = await prisma.mediaAsset.create({
      data: {
        filename: "e2e-seo-pages-small.png",
        originalName: "e2e-seo-pages-small-image.png",
        url: "/images/products/misc/Bottles-group.webp",
        mimeType: "image/png",
        type: "Image",
        sizeBytes: 100,
        width: 600,
        height: 315,
        altText: "A small test image",
      },
    });

    await signIn(page, admin.email);

    // --- Central list shows both pages; the "missing description" filter narrows to the incomplete one ---
    await page.goto("/admin/seo");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(incomplete.name)).toBeVisible();
    await expect(page.getByText(complete.name)).toBeVisible();

    await page.getByRole("checkbox", { name: "Missing meta description" }).click();
    await expect(page.getByText(incomplete.name)).toBeVisible();
    await expect(page.getByText(complete.name)).not.toBeVisible();
    await page.getByRole("checkbox", { name: "Missing meta description" }).click();

    // --- Bulk-apply a title template to the incomplete page ---
    await page.getByRole("checkbox", { name: `Select ${incomplete.name}` }).click();
    await page.getByPlaceholder("{title} | Oristor").fill("{title} | Oristor Sri Lanka");
    await page.getByRole("button", { name: "Apply title template to selected" }).click();
    await expect(page.getByText("1 of 1 page updated.")).toBeVisible();
    await expect(page.getByText(`${incomplete.name} | Oristor Sri Lanka`)).toBeVisible();

    // --- A real OG image below the 1200x630 minimum shows the new health warning in SeoFieldsPanel ---
    await page.goto(`/admin/products/${incomplete.id}`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: "SEO" }).click();
    await page.getByRole("button", { name: "Choose social share image" }).click();
    await expect(page.getByText(smallAsset.originalName)).toBeVisible();
    await page.getByText(smallAsset.originalName).click();
    await expect(page.getByText("✗ Social image is at least 1200x630")).toBeVisible();
    await page.getByRole("button", { name: "Save SEO fields" }).click();
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
  });
});
