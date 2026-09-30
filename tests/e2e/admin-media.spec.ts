import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-admin-media.test";
const ROLE_KEY_PREFIX = "e2e-admin-media-role-";
const SKU_PREFIX = "E2E-ADMIN-MEDIA-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Media Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "E2E Admin", passwordHash, roleId: role.id } });
}

async function makeMinimalProduct() {
  sequence += 1;
  return prisma.product.create({
    data: {
      name: `E2E Media Test Product ${sequence}`,
      slug: `e2e-admin-media-product-${sequence}`,
      sku: `${SKU_PREFIX}${sequence}`,
      nutrition: {
        create: { servingSize: "100g", calories: 0, protein: 0, fat: 0, saturatedFat: 0, carbohydrates: 0, sugar: 0, fibre: 0, sodium: 0 },
      },
    },
  });
}

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

// A 1x1 transparent PNG.
const TINY_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

test.describe("Admin Media Library (STORY-041)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
    await prisma.mediaAsset.deleteMany({ where: { originalName: { startsWith: "e2e-" } } });
    await prisma.mediaFolder.deleteMany({ where: { name: { startsWith: "E2E Media Test" } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  });

  test("create a folder, upload, tag, set alt text, pick from a product form, then delete", async ({ page }) => {
    test.setTimeout(60_000);

    const admin = await makeAdminUser([
      { module: "MediaLibrary", action: "View" },
      { module: "MediaLibrary", action: "Edit" },
      { module: "MediaLibrary", action: "Delete" },
      { module: "Products", action: "View" },
      { module: "Products", action: "Edit" },
    ]);
    const product = await makeMinimalProduct();
    await signIn(page, admin.email);

    // --- Create a folder ---
    await page.goto("/admin/media");
    sequence += 1;
    const folderName = `E2E Media Test Folder ${sequence}`;
    await page.getByPlaceholder("New folder").fill(folderName);
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("button", { name: folderName })).toBeVisible();
    await page.getByRole("button", { name: folderName }).click();

    // --- Upload into the selected folder ---
    const fileName = `e2e-test-image-${sequence}.png`;
    await page.getByRole("button", { name: "Upload" }).click();
    await page.locator("#media-upload-input").setInputFiles({ name: fileName, mimeType: "image/png", buffer: Buffer.from(TINY_PNG_BASE64, "base64") });
    await expect(page.getByText(fileName)).toBeVisible();

    // --- Set alt text ---
    await page.getByText(fileName).click();
    await expect(page.getByText("Required before this asset can be selected elsewhere.")).toBeVisible();
    await page.getByLabel("Alt text").fill("An E2E test image");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Required before this asset can be selected elsewhere.")).toHaveCount(0);
    await page.keyboard.press("Escape");

    // --- Pick it from the product form's Media tab ---
    await page.goto(`/admin/products/${product.id}`);
    // This is the first visit to this route in the dev server's process —
    // Turbopack compiles it lazily on first request. Interacting before
    // that settles (confirmed by reproducing manually: works at a human's
    // pace, fails when driven as fast as Playwright can click) leaves the
    // page in a half-hydrated state where a freshly-added field-array row
    // silently vanishes moments later. Production serves pre-compiled
    // bundles and never hits this — dev-mode-only.
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: "Media" }).click();
    await page.getByRole("button", { name: "Add image" }).click();
    await page.getByRole("button", { name: "Browse Library" }).click();
    await expect(page.getByText(fileName)).toBeVisible();
    await page.getByText(fileName).click();
    await expect(page.getByPlaceholder("Image URL")).toHaveValue(/\/media-files\//);
    await expect(page.getByPlaceholder("Alt text")).toHaveValue("An E2E test image");

    // --- Delete it back in the library ---
    await page.goto("/admin/media");
    await page.getByText(fileName).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(fileName)).toHaveCount(0);
  });

  test("a Viewer-only admin can browse the library but the upload route denies server-side", async ({ page, request }) => {
    const viewer = await makeAdminUser([{ module: "MediaLibrary", action: "View" }]);
    await signIn(page, viewer.email);

    // Per RequirePermission's own doc comment ("hiding a UI button is never
    // treated as access control") and STORY-040's identical precedent
    // (admin-products.spec.ts's Viewer-only test), this only asserts the
    // page loads and the mutating route denies server-side — not that the
    // Upload button is hidden client-side.
    await page.goto("/admin/media");
    await expect(page.getByRole("heading", { name: "Media Library" })).toBeVisible();

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    const response = await request.post("/api/admin/media/upload", {
      multipart: { files: { name: "denied.png", mimeType: "image/png", buffer: Buffer.from(TINY_PNG_BASE64, "base64") } },
      headers: { Cookie: cookieHeader },
    });
    expect(response.status()).toBe(403);
  });
});
