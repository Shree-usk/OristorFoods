import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-admin-recipes.test";
const ROLE_KEY_PREFIX = "e2e-admin-recipes-role-";
const CATEGORY_SLUG_PREFIX = "e2e-admin-recipes-category-";
const SLUG_PREFIX = "e2e-admin-recipes-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Recipes Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "E2E Admin", passwordHash, roleId: role.id } });
}

async function makeCategory() {
  sequence += 1;
  return prisma.recipeCategory.create({ data: { name: `E2E Recipe Category ${sequence}`, slug: `${CATEGORY_SLUG_PREFIX}${sequence}` } });
}

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function signOut(page: import("@playwright/test").Page) {
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
}

test.describe("Admin Recipes Workflow (STORY-043)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    // HomepageLayout.createdBy-style onDelete: SetNull lesson (STORY-042)
    // applies here too — delete recipes (which reference createdBy) before
    // their creator admin, not after.
    await prisma.recipe.deleteMany({ where: { createdBy: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
    await prisma.recipeCategory.deleteMany({ where: { slug: { startsWith: CATEGORY_SLUG_PREFIX } } });
  });

  test("author creates and submits a recipe; reviewer rejects with a comment; author fixes and resubmits; reviewer approves and publishes; the real storefront serves it", async ({ page }) => {
    test.setTimeout(120_000);

    const author = await makeAdminUser([
      { module: "Recipes", action: "View" },
      { module: "Recipes", action: "Edit" },
    ]);
    const reviewer = await makeAdminUser([
      { module: "Recipes", action: "View" },
      { module: "Recipes", action: "Edit" },
      { module: "Recipes", action: "Approve" },
    ]);
    const category = await makeCategory();

    sequence += 1;
    const slug = `${SLUG_PREFIX}${sequence}`;
    const title = `E2E Test Recipe ${sequence}`;

    // --- Author creates the recipe ---
    await signIn(page, author.email);
    await page.goto("/admin/recipes/new");
    await page.waitForLoadState("networkidle");

    await page.getByLabel("Title", { exact: true }).fill(title);
    await page.getByLabel("Slug").fill(slug);
    await page.getByLabel("Short description").fill("A short e2e test description.");
    await page.getByRole("combobox", { name: "Category", exact: true }).click();
    await page.getByRole("option", { name: category.name }).click();
    await page.getByLabel("Servings").fill("4");
    await page.getByLabel("Prep time (minutes)").fill("10");
    await page.getByLabel("Cook time (minutes)").fill("15");

    await page.getByRole("tab", { name: "Ingredients" }).click();
    await page.getByRole("button", { name: "Add ingredient" }).click();
    await page.getByPlaceholder("Ingredient (e.g. red onion, finely chopped)").fill("2 cups flour");

    await page.getByRole("tab", { name: "Steps" }).click();
    await page.getByRole("button", { name: "Add step" }).click();
    await page.getByPlaceholder("Instruction").fill("Mix everything together.");

    await page.getByRole("tab", { name: "Media" }).click();
    await page.locator("#recipe-hero-image").fill("/images/products/misc/Bottles-group.webp");
    await page.locator("#recipe-hero-alt").fill("An e2e test hero image");

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/recipes\/[a-z0-9]+$/);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Draft", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Submit for Review" }).click();
    await expect(page.getByText("Review", { exact: true })).toBeVisible();

    const recipeId = page.url().split("/").pop()!;

    // --- Reviewer previews and rejects with a comment ---
    await signOut(page);
    await signIn(page, reviewer.email);
    await page.goto(`/admin/recipes/${recipeId}/preview`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("Mix everything together.")).toBeVisible();

    await page.goto(`/admin/recipes/${recipeId}`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Reject" }).click();
    const rejectDialog = page.getByRole("dialog");
    await rejectDialog.getByPlaceholder("What needs to change?").fill("Please add more detail to the steps.");
    await rejectDialog.getByRole("button", { name: "Reject", exact: true }).click();
    await expect(page.getByText("Draft", { exact: true })).toBeVisible();

    // --- Author sees the comment, fixes, and resubmits ---
    await signOut(page);
    await signIn(page, author.email);
    await page.goto(`/admin/recipes/${recipeId}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Please add more detail to the steps.")).toBeVisible();
    await page.getByRole("button", { name: "Submit for Review" }).click();
    await expect(page.getByText("Review", { exact: true })).toBeVisible();

    // --- Reviewer approves and publishes ---
    await signOut(page);
    await signIn(page, reviewer.email);
    await page.goto(`/admin/recipes/${recipeId}`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Approved", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Published", { exact: true })).toBeVisible();

    // --- The real storefront query now serves it ---
    await page.goto(`/recipes/${slug}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
  });

  test("a Viewer-only admin can browse recipes but a mutating route denies server-side", async ({ page, request }) => {
    const viewer = await makeAdminUser([{ module: "Recipes", action: "View" }]);
    await signIn(page, viewer.email);

    await page.goto("/admin/recipes");
    await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible();

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    const category = await makeCategory();
    const response = await request.post("/api/admin/recipes", {
      data: {
        slug: `${SLUG_PREFIX}denied`,
        title: "Denied",
        shortDescription: "x",
        categoryId: category.id,
        difficulty: "Easy",
        prepTimeMinutes: 1,
        cookTimeMinutes: 1,
        servings: 1,
      },
      headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
    });
    expect(response.status()).toBe(403);
  });
});
