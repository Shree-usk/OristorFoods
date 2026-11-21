import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

/**
 * Product Story & Export Specifications (PDP visual brief). Exercises the
 * brief's own CMS acceptance test scenarios against the Export Catalogue
 * page (the primary surface — see docs/architecture-decisions.md), plus the
 * general PDP's opt-in gate and cross-product isolation.
 */

const EMAIL_DOMAIN = "@e2e-admin-product-story.test";
const ROLE_KEY_PREFIX = "e2e-admin-product-story-role-";
const CATEGORY_SLUG_PREFIX = "e2e-admin-product-story-category-";
const SKU_PREFIX = "E2E-PRODUCT-STORY-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Product Story Role ${sequence}` } });
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

// Opening an existing product fetches its data client-side and resets the
// form once that fetch resolves; editing a field before that reset lands
// gets silently overwritten back to the fetched value. Waiting for the
// promise heading (always present once seeded) to reach its expected value
// confirms the reset has already run before any further interaction.
async function openStoryTab(page: import("@playwright/test").Page, expectedHeading: string) {
  await page.getByRole("tab", { name: "Product Story & Export Specs" }).click();
  await expect(page.getByPlaceholder("Heading (e.g. No Artificial Preservatives)")).toHaveValue(expectedHeading);
}

// The "Product saved" toast auto-dismisses quickly and races the assertion
// under PGlite's single-connection latency, so wait on the PATCH response
// itself rather than on transient UI — this is what guarantees the write
// actually landed before navigating to a page that reads it back.
async function saveAndWaitForPatch(page: import("@playwright/test").Page) {
  await Promise.all([
    page.waitForResponse((res) => res.request().method() === "PATCH" && res.url().includes("/api/admin/products/") && res.status() === 200),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
}

test.describe("Admin Product Story & Export Specifications", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
    await prisma.category.deleteMany({ where: { slug: { startsWith: CATEGORY_SLUG_PREFIX } } });
  });

  test("full CMS acceptance pass: create, edit, disable, PDP opt-in, cross-product isolation", async ({ page }) => {
    test.setTimeout(180_000);

    const admin = await makeAdminUser([
      { module: "Products", action: "View" },
      { module: "Products", action: "Edit" },
    ]);
    const category = await makeCategory();
    await signIn(page, admin.email);

    // --- Create product A with all three sections ---
    await page.goto("/admin/products/new");
    sequence += 1;
    const slugA = `e2e-product-story-${sequence}`;
    const skuA = `${SKU_PREFIX}${sequence}`;

    await page.getByLabel("Name").fill(`E2E Story Product ${sequence}`);
    await page.getByLabel("Slug").fill(slugA);
    await page.getByLabel("SKU").fill(skuA);
    await page.getByRole("checkbox", { name: category.name }).click();

    await page.getByRole("tab", { name: "Nutrition & Ingredients" }).click();
    await page.getByLabel("Serving size").fill("100g");

    await page.getByRole("tab", { name: "Media" }).click();
    await page.getByRole("button", { name: "Add image" }).click();
    await page.getByPlaceholder("Image URL").fill("/images/products/export/curry-powder.webp");

    await page.getByRole("tab", { name: "Export & Wholesale" }).click();
    await page.getByRole("checkbox", { name: "Enable for Export & Wholesale catalogue" }).click();

    await page.getByRole("tab", { name: "Product Story & Export Specs" }).click();

    await page.getByRole("button", { name: "Add promise attribute" }).click();
    await page.getByPlaceholder("Small image URL").fill("https://example.com/e2e-promise.jpg");
    await page.getByPlaceholder("Heading (e.g. No Artificial Preservatives)").fill("No Artificial Preservatives");

    await page.getByRole("button", { name: "Add preparation stage" }).click();
    await page.getByPlaceholder("01").fill("01");
    await page.getByPlaceholder("Image URL", { exact: true }).fill("https://example.com/e2e-stage-1.jpg");
    await page.getByPlaceholder("Heading (e.g. Carefully Selected)").fill("Carefully Selected");

    await page.getByRole("button", { name: "Add spec item" }).click();
    await page.getByPlaceholder("e.g. 200 g | 350 g").fill("200 g | 350 g");
    await page.getByPlaceholder("Small image URL").last().fill("https://example.com/e2e-spec.jpg");

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/admin\/products\/(?!new$)[^/]+$/);
    const editUrlA = page.url();

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Published", { exact: true })).toBeVisible();

    // A Published product with no resolvable price renders as not-found on
    // the standard PDP (getProductDetail's own guard) — set one so the
    // PDP opt-in scenario later can actually render. The Export Catalogue
    // page has no such requirement, which is why the earlier scenarios
    // against it don't need this.
    await page.getByRole("tab", { name: "Pricing" }).click();
    await page.getByLabel("New price").fill("500");
    await page.getByRole("button", { name: "Set price" }).click();
    await expect(page.getByText("Current: LKR 500")).toBeVisible();

    // --- Scenario: changes appear on the Export Catalogue page once published ---
    await page.goto(`/export/catalogue/${slugA}`);
    await expect(page.getByText("No Artificial Preservatives")).toBeVisible();
    await expect(page.getByText("Carefully Selected")).toBeVisible();
    await expect(page.getByText("200 g | 350 g")).toBeVisible();

    // --- Scenario 1: edit a promise heading, verify the page updates ---
    await page.goto(editUrlA);
    await openStoryTab(page, "No Artificial Preservatives");
    await page.getByPlaceholder("Heading (e.g. No Artificial Preservatives)").fill("Clean Label, No Preservatives");
    await saveAndWaitForPatch(page);

    await page.goto(`/export/catalogue/${slugA}`);
    await expect(page.getByText("Clean Label, No Preservatives")).toBeVisible();
    await expect(page.getByText("No Artificial Preservatives", { exact: true })).toHaveCount(0);

    // --- Scenario 4: disable one promise attribute, verify it disappears ---
    await page.goto(editUrlA);
    await openStoryTab(page, "Clean Label, No Preservatives");
    await page.getByRole("checkbox", { name: "Visible" }).first().click();
    await saveAndWaitForPatch(page);

    await page.goto(`/export/catalogue/${slugA}`);
    await expect(page.getByText("Clean Label, No Preservatives")).toHaveCount(0);
    // The other two sections are untouched.
    await expect(page.getByText("Carefully Selected")).toBeVisible();
    await expect(page.getByText("200 g | 350 g")).toBeVisible();

    // --- Scenario 5: disable the whole preparation section, verify it disappears ---
    await page.goto(editUrlA);
    await openStoryTab(page, "Clean Label, No Preservatives");
    await page.getByRole("checkbox", { name: /Crafted with Care/ }).click();
    await saveAndWaitForPatch(page);

    await page.goto(`/export/catalogue/${slugA}`);
    await expect(page.getByText("Carefully Selected")).toHaveCount(0);
    await expect(page.getByText("200 g | 350 g")).toBeVisible();

    // --- PDP opt-in: off by default on the standard product page, on once switched on ---
    await page.goto(`/products/${slugA}`);
    await expect(page.getByText("200 g | 350 g")).toHaveCount(0);

    await page.goto(editUrlA);
    await openStoryTab(page, "Clean Label, No Preservatives");
    await page.getByRole("checkbox", { name: "Also show these sections on the standard Product Detail Page" }).click();
    await saveAndWaitForPatch(page);

    await page.goto(`/products/${slugA}`);
    await expect(page.getByText("200 g | 350 g")).toBeVisible();

    // --- Cross-product isolation: a second, untouched export-enabled product shows none of product A's content ---
    await page.goto("/admin/products/new");
    sequence += 1;
    const slugB = `e2e-product-story-${sequence}`;
    const skuB = `${SKU_PREFIX}${sequence}`;

    await page.getByLabel("Name").fill(`E2E Story Product ${sequence}`);
    await page.getByLabel("Slug").fill(slugB);
    await page.getByLabel("SKU").fill(skuB);
    await page.getByRole("checkbox", { name: category.name }).click();

    await page.getByRole("tab", { name: "Nutrition & Ingredients" }).click();
    await page.getByLabel("Serving size").fill("100g");

    await page.getByRole("tab", { name: "Media" }).click();
    await page.getByRole("button", { name: "Add image" }).click();
    await page.getByPlaceholder("Image URL").fill("/images/products/export/curry-powder.webp");

    await page.getByRole("tab", { name: "Export & Wholesale" }).click();
    await page.getByRole("checkbox", { name: "Enable for Export & Wholesale catalogue" }).click();

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/admin\/products\/(?!new$)[^/]+$/);
    const editUrlB = page.url();
    await expect(page.getByText("Draft", { exact: true })).toBeVisible();

    // --- Scenario 7: a Draft product is not publicly reachable, even though it's export-enabled ---
    const draftResponse = await page.goto(`/export/catalogue/${slugB}`);
    expect(draftResponse?.status()).toBe(404);

    // --- Scenario 8 / cross-product isolation: publish, then confirm none of product A's content leaked in ---
    await page.goto(editUrlB);
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Published", { exact: true })).toBeVisible();

    await page.goto(`/export/catalogue/${slugB}`);
    await expect(page.getByText("200 g | 350 g")).toHaveCount(0);
    await expect(page.getByText("Clean Label, No Preservatives")).toHaveCount(0);
  });
});
