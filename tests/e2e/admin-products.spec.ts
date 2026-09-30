import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-admin-products.test";
const ROLE_KEY_PREFIX = "e2e-admin-products-role-";
const CATEGORY_SLUG_PREFIX = "e2e-admin-products-category-";
const SKU_PREFIX = "E2E-ADMIN-PRODUCTS-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Products Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "E2E Admin", passwordHash, roleId: role.id } });
}

async function makeCategory() {
  sequence += 1;
  return prisma.category.create({ data: { name: `E2E Category ${sequence}`, slug: `${CATEGORY_SLUG_PREFIX}${sequence}` } });
}

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("Admin Products Module (STORY-040)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
    await prisma.category.deleteMany({ where: { slug: { startsWith: CATEGORY_SLUG_PREFIX } } });
  });

  test("full lifecycle: create, list, edit, publish, archive, duplicate, bulk-delete", async ({ page }) => {
    // Visits several admin routes Turbopack hasn't compiled yet in this dev
    // server process — the default 30s budget is tight against first-visit
    // compile time stacked across create/list/edit/duplicate.
    test.setTimeout(60_000);

    const admin = await makeAdminUser([
      { module: "Products", action: "View" },
      { module: "Products", action: "Edit" },
      { module: "Products", action: "Delete" },
    ]);
    const category = await makeCategory();
    await signIn(page, admin.email);

    // --- Create ---
    await page.goto("/admin/products/new");
    sequence += 1;
    const productName = `E2E Test Product ${sequence}`;
    const slug = `e2e-admin-products-${sequence}`;
    const sku = `${SKU_PREFIX}${sequence}`;

    await page.getByLabel("Name").fill(productName);
    await page.getByLabel("Slug").fill(slug);
    await page.getByLabel("SKU").fill(sku);
    await page.getByRole("checkbox", { name: category.name }).click();

    await page.getByRole("tab", { name: "Nutrition & Ingredients" }).click();
    await page.getByLabel("Serving size").fill("100g");

    await page.getByRole("tab", { name: "Media" }).click();
    await page.getByRole("button", { name: "Add image" }).click();
    await page.getByPlaceholder("Image URL").fill("https://example.com/e2e-product.jpg");

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/admin\/products\/(?!new$)[^/]+$/);
    await expect(page.getByText("Draft", { exact: true })).toBeVisible();

    // --- Appears in the list ---
    await page.goto("/admin/products");
    await expect(page.getByText(productName)).toBeVisible();

    // --- Publish then archive ---
    await page.getByText(productName).click();
    await expect(page).toHaveURL(/\/admin\/products\/[^/]+$/);
    const editUrl = page.url();
    const productId = editUrl.split("/").pop()!;

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Published", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText("Archived", { exact: true })).toBeVisible();

    // --- Duplicate forces a new slug/SKU ---
    await page.getByRole("button", { name: "Duplicate" }).click();
    sequence += 1;
    const dupSlug = `e2e-admin-products-dup-${sequence}`;
    const dupSku = `${SKU_PREFIX}DUP-${sequence}`;
    await page.getByLabel("New slug").fill(dupSlug);
    await page.getByLabel("New SKU").fill(dupSku);
    await page.getByRole("button", { name: "Duplicate", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/products/(?!${productId}$)[^/]+$`));

    // --- Bulk delete from the list (also exercises the multi-select checkbox toolbar) ---
    await page.goto("/admin/products");
    const originalRow = page.locator("tr").filter({ has: page.getByRole("link", { name: productName, exact: true }) });
    await originalRow.getByRole("checkbox").click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("link", { name: productName, exact: true })).toHaveCount(0);
  });

  test("a Viewer-only admin can browse the list but the create route denies server-side", async ({ page }) => {
    const viewer = await makeAdminUser([{ module: "Products", action: "View" }]);
    await signIn(page, viewer.email);

    await page.goto("/admin/products");
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();

    await page.goto("/admin/products/new");
    await expect(page.getByText(/don't have permission|access denied/i)).toBeVisible();
  });
});
