import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";

/** Perfect Match admin CMS, stage 3 (settings, products, pairings). Serial mode: this spec's DB writes under fullyParallel otherwise contend for PGlite's single-connection local dev instance, same precaution as admin-food-academy.spec.ts. */

const EMAIL_DOMAIN = "@e2e-admin-perfect-match.test";
const ROLE_KEY_PREFIX = "e2e-admin-perfect-match-role-";
const PRODUCT_SKU_PREFIX = "e2e-pm-product-";
const MEDIA_ASSET_PREFIX = "e2e-perfect-match-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: "PerfectMatch" | "MediaLibrary"; action: "View" | "Edit" | "Delete" }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Perfect Match Role ${sequence}` } });
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

function fullAccessGrants(): { module: "PerfectMatch" | "MediaLibrary"; action: "View" | "Edit" | "Delete" }[] {
  return [
    { module: "PerfectMatch", action: "View" },
    { module: "PerfectMatch", action: "Edit" },
    { module: "PerfectMatch", action: "Delete" },
    // The pairing form's image field opens AssetPickerDialog, which lists
    // the Media Library and requires its own View permission.
    { module: "MediaLibrary", action: "View" },
  ];
}

test.describe("Admin Perfect Match — settings, products, pairings", () => {
  test.describe.configure({ mode: "serial" });

  test.afterEach(async () => {
    await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
    await prisma.perfectMatchPairing.deleteMany({ where: { perfectMatchProduct: { product: { sku: { startsWith: PRODUCT_SKU_PREFIX } } } } });
    await prisma.perfectMatchProduct.deleteMany({ where: { product: { sku: { startsWith: PRODUCT_SKU_PREFIX } } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: PRODUCT_SKU_PREFIX } } });
    await prisma.mediaAsset.deleteMany({ where: { originalName: { startsWith: MEDIA_ASSET_PREFIX } } });
  });

  test("editing and saving the intro settings persists", async ({ page }) => {
    const admin = await makeAdminUser(fullAccessGrants());
    await signIn(page, admin.email);

    await page.goto("/admin/perfect-match");
    await expect(page.getByRole("heading", { name: "The Perfect Match" })).toBeVisible();

    const heading = "E2E Ordinary Meals. Extraordinary Flavours.";
    await page.locator("#pm-heading").fill(heading);
    await page.getByRole("button", { name: "Save Settings" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    await page.reload();
    await expect(page.locator("#pm-heading")).toHaveValue(heading);
  });

  test("adding a product, editing its overlay fields, adding pairings up to the limit of 4, and removing the product", async ({ page }) => {
    sequence += 1;
    const productName = `E2E Perfect Match Product ${sequence}`;
    await prisma.product.create({
      data: { sku: `${PRODUCT_SKU_PREFIX}${sequence}`, slug: `${PRODUCT_SKU_PREFIX}${sequence}`, name: productName, status: "Published" },
    });
    const asset = await prisma.mediaAsset.create({
      data: {
        filename: `${MEDIA_ASSET_PREFIX}${sequence}.png`,
        originalName: `${MEDIA_ASSET_PREFIX}${sequence}-pairing.png`,
        url: "/images/products/export/curry-powder.webp",
        mimeType: "image/png",
        type: "Image",
        sizeBytes: 100,
        altText: "E2E pairing test image",
      },
    });

    const admin = await makeAdminUser(fullAccessGrants());
    await signIn(page, admin.email);

    await page.goto("/admin/perfect-match/products");
    await page.getByRole("button", { name: "Add product" }).click();
    await page.getByPlaceholder("Search products…").fill(productName);
    await page.getByRole("button", { name: productName }).click();
    await expect(page.getByText("Product added")).toBeVisible();
    await expect(page.getByText(productName)).toBeVisible();

    // The Manage link renders as <a role="button"> (Base UI's Button
    // primitive sets role="button" even with nativeButton={false}), so
    // it's queried as a button, not a link.
    await page.getByRole("button", { name: "Manage" }).click();
    await expect(page).toHaveURL(/\/perfect-match\/products\/[a-z0-9]{10,}$/i);

    await page.locator("#pm-product-kicker").fill("A traditional favourite");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    for (let i = 1; i <= 4; i += 1) {
      await page.getByRole("button", { name: "Add pairing" }).click();
      await page.locator("#pm-pairing-title").fill(`E2E Pairing ${i}`);
      await page.getByRole("button", { name: "Upload image" }).click();
      await expect(page.getByText(asset.originalName)).toBeVisible();
      await page.getByText(asset.originalName).click();
      await page.locator("#pm-pairing-status").click();
      await page.getByRole("option", { name: "Published", exact: true }).click();
      await page.getByRole("button", { name: "Add pairing", exact: true }).click();
      await expect(page.getByText("Pairing saved")).toBeVisible();
    }
    await expect(page.getByText(`4 / 4 published`)).toBeVisible();
    // A 5th pairing has nowhere to go — the "Add pairing" button hides itself once the limit is reached.
    await expect(page.getByRole("button", { name: "Add pairing" })).not.toBeVisible();

    await page.goto("/admin/perfect-match/products");
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("Product removed")).toBeVisible();
    await expect(page.getByText(productName)).not.toBeVisible();
  });

  test("a role without PerfectMatch permission is denied access", async ({ page }) => {
    const admin = await makeAdminUser([]);
    await signIn(page, admin.email);

    await page.goto("/admin/perfect-match");
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();

    await page.goto("/admin/perfect-match/products");
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
  });
});
