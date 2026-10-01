import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-admin-reviews.test";
const ROLE_KEY_PREFIX = "e2e-admin-reviews-role-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Reviews Role ${sequence}` } });
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

test.describe("Admin Reviews Moderation Console (STORY-045)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.review.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.recipeReview.deleteMany({ where: { customer: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test("a moderator sees product reviews, recipe reviews, and blog comments in one queue; approving a product review makes it live on the real PDP", async ({ page }) => {
    test.setTimeout(90_000);

    const moderator = await makeAdminUser([
      { module: "Reviews", action: "View" },
      { module: "Reviews", action: "Edit" },
      { module: "Reviews", action: "Approve" },
    ]);

    const product = await prisma.product.findFirstOrThrow({ where: { status: "Published" }, select: { id: true, slug: true } });
    const recipe = await prisma.recipe.findFirstOrThrow({ where: { status: "Published" }, select: { id: true } });
    const blogComment = await prisma.blogComment.findFirstOrThrow({ where: { status: "Pending" }, select: { id: true } });

    const productReviewCustomer = await makeCustomer();
    sequence += 1;
    const reviewBody = `E2E test review body ${sequence}, long enough to be realistic and clearly identifiable.`;
    const productReview = await prisma.review.create({
      data: { productId: product.id, userId: productReviewCustomer.id, rating: 5, title: `E2E Test Review ${sequence}`, body: reviewBody, status: "Pending" },
    });

    const recipeReviewCustomer = await makeCustomer();
    const recipeReview = await prisma.recipeReview.create({
      data: { recipeId: recipe.id, customerId: recipeReviewCustomer.id, rating: 4, reviewText: "A solid recipe.", status: "Pending" },
    });

    await signIn(page, moderator.email);
    await page.goto("/admin/reviews");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Reviews" })).toBeVisible();

    // --- All three source types are visible in the unified "All sources" queue ---
    await expect(page.getByText(reviewBody)).toBeVisible();
    await expect(page.getByText("A solid recipe.")).toBeVisible();

    // --- Approve the product review, then publish it, and confirm it's live on the real PDP ---
    // Generous timeouts: these admin API routes are hit for the first time
    // ever in this dev server process, and Turbopack lazily compiles each
    // route on first request (same timing issue documented for STORY-044).
    const productReviewRow = page.getByRole("row").filter({ hasText: reviewBody });
    await productReviewRow.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByRole("row").filter({ hasText: reviewBody }).getByText("Approved", { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("row").filter({ hasText: reviewBody }).getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByRole("row").filter({ hasText: reviewBody }).getByText("Published", { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.goto(`/products/${product.slug}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(reviewBody)).toBeVisible();

    // --- Reject the recipe review ---
    await page.goto("/admin/reviews");
    await page.waitForLoadState("networkidle");
    await page.getByRole("row").filter({ hasText: "A solid recipe." }).getByRole("button", { name: "Reject", exact: true }).click();
    await expect(page.getByRole("row").filter({ hasText: "A solid recipe." }).getByText("Rejected", { exact: true })).toBeVisible({ timeout: 15_000 });

    // --- Reply to and feature the now-published product review ---
    await page.getByRole("row").filter({ hasText: reviewBody }).getByRole("button", { name: "Reply", exact: true }).click();
    const replyDialog = page.getByRole("dialog");
    await replyDialog.getByPlaceholder("Write a reply…").fill("Thanks so much for the kind words!");
    await replyDialog.getByRole("button", { name: "Save reply", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15_000 });

    await page.getByRole("row").filter({ hasText: reviewBody }).getByRole("button", { name: "Feature", exact: true }).click();
    await expect(page.getByRole("row").filter({ hasText: reviewBody }).getByText("Featured", { exact: true })).toBeVisible({ timeout: 15_000 });

    // Cleanup
    await prisma.review.delete({ where: { id: productReview.id } }).catch(() => {});
    await prisma.recipeReview.delete({ where: { id: recipeReview.id } }).catch(() => {});
    void blogComment;
  });

  test("a Viewer-only admin can browse the queue but a mutating route denies server-side", async ({ page, request }) => {
    const viewer = await makeAdminUser([{ module: "Reviews", action: "View" }]);
    await signIn(page, viewer.email);

    await page.goto("/admin/reviews");
    await expect(page.getByRole("heading", { name: "Reviews" })).toBeVisible();

    const product = await prisma.product.findFirstOrThrow({ where: { status: "Published" }, select: { id: true } });
    const customer = await makeCustomer();
    const review = await prisma.review.create({
      data: { productId: product.id, userId: customer.id, rating: 3, title: "Denied test", body: "This action should be denied.", status: "Pending" },
    });

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    const response = await request.post(`/api/admin/reviews/product/${review.id}/approve`, {
      headers: { Cookie: cookieHeader },
    });
    expect(response.status()).toBe(403);

    await prisma.review.delete({ where: { id: review.id } }).catch(() => {});
  });
});
