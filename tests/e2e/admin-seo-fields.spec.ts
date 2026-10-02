import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-admin-seo-fields.test";
const ROLE_KEY_PREFIX = "e2e-admin-seo-fields-role-";
const CATEGORY_SLUG_PREFIX = "e2e-admin-seo-fields-category-";
const SKU_PREFIX = "E2E-ADMIN-SEO-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin SEO Fields Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "E2E Admin", passwordHash, roleId: role.id } });
}

async function makeCategory() {
  sequence += 1;
  return prisma.category.create({ data: { name: `E2E SEO Category ${sequence}`, slug: `${CATEGORY_SLUG_PREFIX}${sequence}` } });
}

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("Admin SEO Fields Panel (STORY-051a)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    const existingProducts = await prisma.product.findMany({ where: { sku: { startsWith: SKU_PREFIX } }, select: { id: true } });
    await prisma.seoMeta.deleteMany({ where: { entityId: { in: existingProducts.map((p) => p.id) } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
    await prisma.category.deleteMany({ where: { slug: { startsWith: CATEGORY_SLUG_PREFIX } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test("edits a real product's SEO fields through the embedded panel and the public PDP reflects them", async ({ page }) => {
    test.setTimeout(60_000);

    const admin = await makeAdminUser([
      { module: "Products", action: "View" },
      { module: "Products", action: "Edit" },
      { module: "SEO", action: "View" },
      { module: "SEO", action: "Edit" },
    ]);
    const category = await makeCategory();
    await signIn(page, admin.email);

    await page.goto("/admin/products/new");
    sequence += 1;
    const productName = `E2E SEO Test Product ${sequence}`;
    const slug = `e2e-admin-seo-fields-${sequence}`;
    const sku = `${SKU_PREFIX}${sequence}`;
    const metaTitle = `Custom SEO Title ${sequence}`;

    await page.getByLabel("Name").fill(productName);
    await page.getByLabel("Slug").fill(slug);
    await page.getByLabel("SKU").fill(sku);
    await page.getByRole("checkbox", { name: category.name }).click();

    await page.getByRole("tab", { name: "Nutrition & Ingredients" }).click();
    await page.getByLabel("Serving size").fill("100g");

    await page.getByRole("tab", { name: "Media" }).click();
    await page.getByRole("button", { name: "Add image" }).click();
    await page.getByPlaceholder("Image URL").fill("https://example.com/e2e-seo-product.jpg");

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/admin\/products\/(?!new$)[^/]+$/);

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Published", { exact: true })).toBeVisible();

    // A Published product with no resolvable price renders as not-found on
    // the storefront (getProductDetail's own guard) — set one so the PDP
    // actually renders for this test's later visit.
    await page.getByRole("tab", { name: "Pricing" }).click();
    await page.getByLabel("New price").fill("500");
    await page.getByRole("button", { name: "Set price" }).click();
    await expect(page.getByText("Current: LKR 500")).toBeVisible();

    // The SeoFieldsPanel is self-contained — its own save, not the product form's.
    await page.getByRole("tab", { name: "SEO" }).click();
    await page.getByLabel("Meta title").fill(metaTitle);
    await page.getByRole("button", { name: "Save SEO fields" }).click();
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible();

    // A real, separate storefront visitor sees the custom title.
    const visitorContext = await page.context().browser()!.newContext();
    const visitorPage = await visitorContext.newPage();
    await visitorPage.goto(`/products/${slug}`);
    await expect(visitorPage).toHaveTitle(new RegExp(metaTitle));
    await visitorContext.close();
  });
});
