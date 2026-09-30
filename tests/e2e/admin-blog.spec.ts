import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-admin-blog.test";
const ROLE_KEY_PREFIX = "e2e-admin-blog-role-";
const AUTHOR_SLUG_PREFIX = "e2e-admin-blog-author-";
const SLUG_PREFIX = "e2e-admin-blog-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Blog Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "E2E Admin", passwordHash, roleId: role.id } });
}

async function makeAuthor() {
  sequence += 1;
  return prisma.blogAuthor.create({ data: { name: `E2E Blog Author ${sequence}`, slug: `${AUTHOR_SLUG_PREFIX}${sequence}` } });
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

test.describe("Admin Blog Editor (STORY-044)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    // Same onDelete: SetNull lesson as STORY-042/043 — delete posts (which
    // reference createdBy) and their comments before their creator admin.
    await prisma.blogComment.deleteMany({ where: { post: { createdBy: { email: { endsWith: EMAIL_DOMAIN } } } } });
    await prisma.blogPost.deleteMany({ where: { createdBy: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
    await prisma.blogAuthor.deleteMany({ where: { slug: { startsWith: AUTHOR_SLUG_PREFIX } } });
  });

  test("author creates and publishes a post with a recipe embed; reviewer approves a pending comment; both appear on the real storefront", async ({ page }) => {
    test.setTimeout(120_000);

    const author = await makeAdminUser([
      { module: "Blog", action: "View" },
      { module: "Blog", action: "Edit" },
    ]);
    const reviewer = await makeAdminUser([
      { module: "Blog", action: "View" },
      { module: "Blog", action: "Edit" },
      { module: "Blog", action: "Approve" },
    ]);
    const blogAuthor = await makeAuthor();

    const publishedRecipe = await prisma.recipe.findFirstOrThrow({ where: { status: "Published" }, select: { slug: true, title: true } });

    sequence += 1;
    const slug = `${SLUG_PREFIX}${sequence}`;
    const title = `E2E Test Blog Post ${sequence}`;

    // --- Author creates the post ---
    await signIn(page, author.email);
    await page.goto("/admin/blog/posts/new");
    await page.waitForLoadState("networkidle");

    await page.getByLabel("Title", { exact: true }).fill(title);
    await page.getByLabel("Slug").fill(slug);
    await page.getByLabel("Excerpt").fill("A short e2e test excerpt.");
    await page.getByRole("combobox", { name: "Author", exact: true }).click();
    await page.getByRole("option", { name: blogAuthor.name }).click();

    await page.getByRole("tab", { name: "Body" }).click();
    await page.locator("#blog-body").fill(`This is the test post body.\n\n[[recipe:${publishedRecipe.slug}]]`);

    await page.getByRole("button", { name: "Save", exact: true }).click();
    // [a-z0-9]{20,} (not just [a-z0-9]+) so this never trivially matches
    // the literal "new" segment of /admin/blog/posts/new.
    await expect(page).toHaveURL(/\/admin\/blog\/posts\/[a-z0-9]{20,}$/);
    // A client-side router.push navigation, not a full page load — wait
    // on the form actually being repopulated (proof reset() ran) rather
    // than networkidle, which doesn't reliably track a post-navigation
    // useQuery fetch dispatched after the SPA transition settles.
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title, { timeout: 15_000 });
    await expect(page.getByText("Draft", { exact: true })).toBeVisible();

    const postId = page.url().split("/").pop()!;

    // --- Publish immediately ---
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    const publishDialog = page.getByRole("dialog");
    await publishDialog.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Live", { exact: true })).toBeVisible();

    // --- The real storefront serves it, with the recipe embed resolved ---
    await page.goto(`/blog/${slug}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    await expect(page.getByText(publishedRecipe.title)).toBeVisible();

    // --- Reviewer approves a seeded pending comment ---
    const comment = await prisma.blogComment.create({
      data: { postId, authorName: "E2E Commenter", authorEmail: "e2e-commenter@example.com", body: "A genuinely helpful e2e test comment.", status: "Pending" },
    });

    await signOut(page);
    await signIn(page, reviewer.email);
    await page.goto("/admin/blog/comments");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(comment.body)).toBeVisible();
    await page
      .getByRole("row")
      .filter({ hasText: comment.body })
      .getByRole("button", { name: "Approve", exact: true })
      .click();
    await expect(page.getByText(comment.body)).not.toBeVisible();

    await page.goto(`/blog/${slug}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(comment.body)).toBeVisible();
  });

  test("a post scheduled for the future shows as Scheduled in the admin list and is absent from the storefront", async ({ page }) => {
    test.setTimeout(60_000);

    const author = await makeAdminUser([
      { module: "Blog", action: "View" },
      { module: "Blog", action: "Edit" },
    ]);
    const blogAuthor = await makeAuthor();

    sequence += 1;
    const slug = `${SLUG_PREFIX}${sequence}`;
    const title = `E2E Scheduled Post ${sequence}`;

    await signIn(page, author.email);
    await page.goto("/admin/blog/posts/new");
    await page.waitForLoadState("networkidle");

    await page.getByLabel("Title", { exact: true }).fill(title);
    await page.getByLabel("Slug").fill(slug);
    await page.getByLabel("Excerpt").fill("A short e2e test excerpt.");
    await page.getByRole("combobox", { name: "Author", exact: true }).click();
    await page.getByRole("option", { name: blogAuthor.name }).click();
    await page.getByRole("tab", { name: "Body" }).click();
    await page.locator("#blog-body").fill("This post is scheduled into the future.");

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/blog\/posts\/[a-z0-9]{20,}$/);
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title, { timeout: 15_000 });

    await page.getByRole("button", { name: "Publish", exact: true }).click();
    const publishDialog = page.getByRole("dialog");
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
    const pad = (n: number) => String(n).padStart(2, "0");
    const localValue = `${futureDate.getFullYear()}-${pad(futureDate.getMonth() + 1)}-${pad(futureDate.getDate())}T${pad(futureDate.getHours())}:${pad(futureDate.getMinutes())}`;
    await publishDialog.locator("#blog-publish-at").fill(localValue);
    await publishDialog.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Scheduled", { exact: true })).toBeVisible();

    await page.goto("/admin/blog/posts");
    await page.waitForLoadState("networkidle");
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: title })
        .getByText("Scheduled", { exact: true }),
    ).toBeVisible();

    await page.goto("/blog");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(title)).not.toBeVisible();
  });

  test("a Viewer-only admin can browse blog posts and comments but a mutating route denies server-side", async ({ page, request }) => {
    const viewer = await makeAdminUser([{ module: "Blog", action: "View" }]);
    await signIn(page, viewer.email);

    await page.goto("/admin/blog/posts");
    await expect(page.getByRole("heading", { name: "Blog" })).toBeVisible();

    await page.goto("/admin/blog/comments");
    await expect(page.getByRole("heading", { name: "Blog Comments" })).toBeVisible();

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    const blogAuthor = await makeAuthor();
    const response = await request.post("/api/admin/blog/posts", {
      data: {
        slug: `${SLUG_PREFIX}denied`,
        title: "Denied",
        excerpt: "x",
        bodyContent: "x",
        authorId: blogAuthor.id,
      },
      headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
    });
    expect(response.status()).toBe(403);
  });
});
