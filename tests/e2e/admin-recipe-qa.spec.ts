import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-admin-recipe-qa.test";
const ROLE_KEY_PREFIX = "e2e-admin-recipe-qa-role-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Recipe QA Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "E2E Admin", passwordHash, roleId: role.id } });
}

async function makeCustomer() {
  sequence += 1;
  return prisma.user.create({ data: { email: `customer-${sequence}${EMAIL_DOMAIN}`, name: `E2E Customer ${sequence}` } });
}

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("Admin Recipe Q&A Moderation Console (STORY-046.1)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.recipeQuestion.deleteMany({ where: { customer: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test("an author answers a question; a separate reviewer approves and publishes it; it's live on the real recipe page; the author alone can't approve their own answer", async ({ page }) => {
    test.setTimeout(90_000);

    const author = await makeAdminUser([
      { module: "QA", action: "View" },
      { module: "QA", action: "Edit" },
    ]);
    const reviewer = await makeAdminUser([
      { module: "QA", action: "View" },
      { module: "QA", action: "Approve" },
    ]);

    const recipe = await prisma.recipe.findFirstOrThrow({ where: { status: "Published" }, select: { id: true, slug: true } });
    const customer = await makeCustomer();
    sequence += 1;
    const questionText = `E2E test question ${sequence}, can this be made ahead of time?`;
    const question = await prisma.recipeQuestion.create({ data: { recipeId: recipe.id, customerId: customer.id, text: questionText, status: "Pending" } });

    // --- Author answers (Edit only — cannot approve) ---
    await signIn(page, author.email);
    await page.goto("/admin/recipe-questions");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Recipe Q&A" })).toBeVisible();
    await expect(page.getByText(questionText)).toBeVisible();

    const questionRow = page.getByRole("row").filter({ hasText: questionText });
    await questionRow.getByRole("button", { name: "Answer", exact: true }).click();
    const answerDialog = page.getByRole("dialog");
    await answerDialog.getByPlaceholder("Write an answer…").fill("Yes, prepare it a day ahead and reheat gently.");
    await answerDialog.getByRole("button", { name: "Save answer", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15_000 });

    // The default queue filter is "Pending" (SLA-style default) — the
    // now-Answered question correctly leaves that view.
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "All statuses" }).click();
    await expect(page.getByRole("row").filter({ hasText: questionText }).getByText("Answered", { exact: true })).toBeVisible({ timeout: 15_000 });

    // The author alone can't approve their own answer server-side.
    const authorCookies = await page.context().cookies();
    const authorCookieHeader = authorCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    const deniedResponse = await page.request.post(`/api/admin/recipe-questions/${question.id}/approve`, { headers: { Cookie: authorCookieHeader } });
    expect(deniedResponse.status()).toBe(403);

    // --- A separate reviewer approves and publishes ---
    await signIn(page, reviewer.email);
    await page.goto("/admin/recipe-questions");
    await page.waitForLoadState("networkidle");
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "All statuses" }).click();

    const reviewerRow = page.getByRole("row").filter({ hasText: questionText });
    await reviewerRow.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByRole("row").filter({ hasText: questionText }).getByText("Approved", { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("row").filter({ hasText: questionText }).getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByRole("row").filter({ hasText: questionText }).getByText("Published", { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.goto(`/recipes/${recipe.slug}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(questionText)).toBeVisible();

    await prisma.recipeQuestion.delete({ where: { id: question.id } }).catch(() => {});
  });

  test("a Viewer-only admin can browse the queue but a mutating route denies server-side", async ({ page, request }) => {
    const viewer = await makeAdminUser([{ module: "QA", action: "View" }]);
    await signIn(page, viewer.email);

    await page.goto("/admin/recipe-questions");
    await expect(page.getByRole("heading", { name: "Recipe Q&A" })).toBeVisible();

    const recipe = await prisma.recipe.findFirstOrThrow({ where: { status: "Published" }, select: { id: true } });
    const customer = await makeCustomer();
    const question = await prisma.recipeQuestion.create({ data: { recipeId: recipe.id, customerId: customer.id, text: "Denied test question.", status: "Pending" } });

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    const response = await request.post(`/api/admin/recipe-questions/${question.id}/answer`, {
      headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
      data: { answerText: "Should be denied." },
    });
    expect(response.status()).toBe(403);

    await prisma.recipeQuestion.delete({ where: { id: question.id } }).catch(() => {});
  });
});
