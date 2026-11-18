import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";

/** Food Academy admin CMS, stage 2 (page settings + categories). Serial mode: this spec's DB writes under fullyParallel otherwise contend for PGlite's single-connection local dev instance, same precaution as admin-story-pages.spec.ts. */

const EMAIL_DOMAIN = "@e2e-admin-food-academy.test";
const ROLE_KEY_PREFIX = "e2e-admin-food-academy-role-";
const CATEGORY_SLUG_PREFIX = "e2e-fa-category-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: "FoodAcademy"; action: "View" | "Edit" | "Delete" }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Food Academy Role ${sequence}` } });
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

test.describe("Admin Food Academy — page settings & categories", () => {
  test.describe.configure({ mode: "serial" });

  test.afterEach(async () => {
    await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
    await prisma.foodAcademyCategory.deleteMany({ where: { slug: { startsWith: CATEGORY_SLUG_PREFIX } } });
  });

  test("editing and saving the page settings hero heading persists", async ({ page }) => {
    const admin = await makeAdminUser([
      { module: "FoodAcademy", action: "View" },
      { module: "FoodAcademy", action: "Edit" },
    ]);
    await signIn(page, admin.email);

    await page.goto("/admin/food-academy");
    await expect(page.getByRole("heading", { name: "Food Academy" })).toBeVisible();

    const heading = "E2E Edited Hero Heading";
    await page.locator("#fa-hero-heading").fill(heading);
    await page.getByRole("button", { name: "Save Page Settings" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    await page.reload();
    await expect(page.locator("#fa-hero-heading")).toHaveValue(heading);
  });

  test("creating, editing and deleting a category", async ({ page }) => {
    const admin = await makeAdminUser([
      { module: "FoodAcademy", action: "View" },
      { module: "FoodAcademy", action: "Edit" },
      { module: "FoodAcademy", action: "Delete" },
    ]);
    await signIn(page, admin.email);

    await page.goto("/admin/food-academy");
    await page.getByRole("tab", { name: "Categories" }).click();

    await page.getByRole("button", { name: "Add category" }).click();
    const name = "E2E Ingredient School";
    const slug = `${CATEGORY_SLUG_PREFIX}${Date.now()}`;
    await page.locator("#fa-cat-name").fill(name);
    await page.locator("#fa-cat-slug").fill(slug);
    await page.getByRole("button", { name: "Add category" }).click();
    await expect(page.getByText("Category saved")).toBeVisible();
    await expect(page.getByText(name)).toBeVisible();

    await page.getByRole("button", { name: "Edit" }).click();
    const renamed = "E2E Ingredient School Renamed";
    await page.locator("#fa-cat-name").fill(renamed);
    await page.getByRole("button", { name: "Save category" }).click();
    await expect(page.getByText("Category saved")).toBeVisible();
    await expect(page.getByText(renamed)).toBeVisible();

    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("Category removed")).toBeVisible();
    await expect(page.getByText(renamed)).not.toBeVisible();
  });

  test("a role without FoodAcademy permission is denied access", async ({ page }) => {
    const admin = await makeAdminUser([]);
    await signIn(page, admin.email);

    await page.goto("/admin/food-academy");
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
  });
});
