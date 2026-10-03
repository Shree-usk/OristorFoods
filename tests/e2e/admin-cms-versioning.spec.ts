import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";

const EMAIL_DOMAIN = "@e2e-admin-cms-versioning.test";
const ROLE_KEY_PREFIX = "e2e-admin-cms-versioning-role-";
const SLUG_PREFIX = "e2e-cms-versioning-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin CMS Versioning Role ${sequence}` } });
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

test.describe("Admin CMS Versioning (STORY-053, additive scope)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    const recipeIds = await prisma.recipe.findMany({ where: { slug: { startsWith: SLUG_PREFIX } }, select: { id: true } }).then((rows) => rows.map((r) => r.id));
    await prisma.contentVersion.deleteMany({ where: { entityType: "Recipe", entityId: { in: recipeIds } } });
    await prisma.recipe.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await prisma.recipeCategory.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test("publishing a recipe twice creates two versions, diffing shows the title change, and restoring the older one reverts both content and status to Draft", async ({ page }) => {
    test.setTimeout(90_000);

    const admin = await makeAdminUser([
      { module: "Recipes", action: "View" },
      { module: "Recipes", action: "Edit" },
      { module: "Recipes", action: "Approve" },
    ]);

    sequence += 1;
    const category = await createRecipeCategory({ name: `E2E CMS Versioning Category ${sequence}`, slug: `${SLUG_PREFIX}category-${sequence}` });
    const recipe = await createRecipe({
      slug: `${SLUG_PREFIX}recipe-${sequence}`,
      title: "E2E CMS Original",
      shortDescription: "A test recipe.",
      heroImage: "/images/products/export/curry-powder.webp",
      heroImageAlt: "Test",
      categoryId: category.id,
      difficulty: "Easy",
      prepTimeMinutes: 10,
      cookTimeMinutes: 20,
      totalTimeMinutes: 30,
      servings: 4,
      status: "Draft",
      ingredients: { create: [{ displayText: "Salt, to taste", sortOrder: 0 }] },
      steps: { create: [{ stepNumber: 1, instruction: "Combine everything." }] },
    });

    await signIn(page, admin.email);
    await page.goto(`/admin/recipes/${recipe.id}`);
    await page.waitForLoadState("networkidle");

    // --- First publish: Draft -> Review -> Approved -> Published (version 1) ---
    await page.getByRole("button", { name: "Submit for Review" }).click();
    await expect(page.getByText("Review", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByText("Approved", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Published", { exact: true })).toBeVisible();

    // --- Back to Draft via the recipe's own Archive/Restore actions (not version-restore) to make a second edit ---
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.getByText("Archived", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Restore to Draft" }).click();
    await expect(page.getByText("Draft", { exact: true }).first()).toBeVisible();

    await page.getByLabel("Title", { exact: true }).fill("E2E CMS Updated");
    await page.getByRole("button", { name: "Save" }).click();

    // --- Second publish: Draft -> Review -> Approved -> Published (version 2) ---
    await page.getByRole("button", { name: "Submit for Review" }).click();
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Published", { exact: true })).toBeVisible();

    // --- History tab: two versions, diffing shows the title change ---
    await page.getByRole("tab", { name: "History" }).click();
    const versionRows = page.getByText(/^Version \d+ —/);
    await expect(versionRows).toHaveCount(2);

    await page.getByRole("checkbox").nth(0).check();
    await page.getByRole("checkbox").nth(1).check();
    await expect(page.getByText("E2E CMS Original")).toBeVisible();
    await expect(page.getByText("E2E CMS Updated").first()).toBeVisible();

    // --- Restore the older version (version 1) — content and status both revert, but only after a reload (the form only re-seeds once per recipe id) ---
    const olderVersionRow = page.locator("li", { hasText: "Version 1 —" });
    // The click only triggers an async request — wait for the actual
    // rollback response to resolve (not just "no error text appeared,"
    // which is trivially true before the request even lands) or the
    // reload below can race ahead of the mutation completing.
    const rollbackResponsePromise = page.waitForResponse((response) => response.url().includes("/rollback") && response.request().method() === "POST");
    await olderVersionRow.getByRole("button", { name: "Restore as draft" }).click();
    const rollbackResponse = await rollbackResponsePromise;
    expect(rollbackResponse.status()).toBe(200);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue("E2E CMS Original");
    await expect(page.getByText("Draft", { exact: true }).first()).toBeVisible();
  });
});
