import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-admin-landing-pages.test";
const ROLE_KEY_PREFIX = "e2e-admin-landing-pages-role-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Landing Pages Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "E2E Admin", passwordHash, roleId: role.id } });
}

async function signInAdmin(page: import("@playwright/test").Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("Admin Landing Page Builder (STORY-050e)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.landingPageBlock.deleteMany({ where: { landingPage: { name: { startsWith: "E2E Landing" } } } });
    await prisma.landingPage.deleteMany({ where: { name: { startsWith: "E2E Landing" } } });
    await prisma.mediaAsset.deleteMany({ where: { originalName: { startsWith: "e2e-landing-page-" } } });
    await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test("a View/Edit-only admin cannot publish; a full-access admin builds, publishes, and the storefront renders it; a Draft page 404s", async ({ page, browser }) => {
    test.setTimeout(120_000);

    const editor = await makeAdminUser([
      { module: "Marketing", action: "View" },
      { module: "Marketing", action: "Edit" },
    ]);
    const admin = await makeAdminUser([
      { module: "Marketing", action: "View" },
      { module: "Marketing", action: "Edit" },
      { module: "Marketing", action: "Approve" },
      { module: "MediaLibrary", action: "View" },
    ]);

    const asset = await prisma.mediaAsset.create({
      data: {
        filename: "e2e-landing-page-asset.png",
        originalName: "e2e-landing-page-hero.png",
        url: "/images/products/misc/Bottles-group.webp",
        mimeType: "image/png",
        type: "Image",
        sizeBytes: 100,
        altText: "E2E landing page hero image",
      },
    });

    sequence += 1;
    const pageName = `E2E Landing ${sequence}`;
    const slug = `e2e-landing-${sequence}`;
    const headline = `E2E Landing Headline ${sequence}`;

    await signInAdmin(page, admin.email);
    await page.goto("/admin/marketing/landing-pages");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "New landing page" }).click();
    await page.getByLabel("Internal name").fill(pageName);
    await page.getByLabel("URL slug").fill(slug);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    // "new" itself would also match a bare [a-z0-9]+ pattern — require the cuid's leading "c" to exclude it.
    await expect(page).toHaveURL(/\/admin\/marketing\/landing-pages\/c[a-z0-9]+$/, { timeout: 15_000 });
    const landingPageId = page.url().split("/").pop()!;

    await page.getByRole("button", { name: "Add block" }).click();
    await expect(page.getByText(asset.originalName)).toBeVisible();
    await page.getByText(asset.originalName).click();
    await expect(page.getByLabel("Headline", { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.getByLabel("Headline", { exact: true }).fill(headline);
    await page.getByLabel("CTA label", { exact: true }).fill("Shop the sale");
    await page.getByLabel("CTA link", { exact: true }).fill("/products");
    await page.getByRole("button", { name: "Save block" }).click();

    // The View/Edit-only admin cannot publish — server-side 403, not just a hidden button.
    const editorContext = await browser.newContext();
    const editorPage = await editorContext.newPage();
    await signInAdmin(editorPage, editor.email);
    const deniedResponse = await editorContext.request.post(`/api/admin/marketing/landing-pages/${landingPageId}/status`, {
      headers: { "Content-Type": "application/json" },
      data: { status: "Published" },
    });
    expect(deniedResponse.status()).toBe(403);
    await editorContext.close();

    // The full-access admin publishes successfully.
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Published", { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    // A real, separate storefront visitor sees the published page.
    const visitorContext = await browser.newContext();
    const visitorPage = await visitorContext.newPage();
    const response = await visitorPage.goto(`/landing/${slug}`);
    expect(response?.status()).toBe(200);
    await expect(visitorPage.getByText(headline)).toBeVisible({ timeout: 15_000 });
    await expect(visitorPage.getByRole("button", { name: "Shop the sale" })).toHaveAttribute("href", "/products");

    // A second, Draft-only landing page 404s for that same visitor.
    sequence += 1;
    const draftSlug = `e2e-landing-${sequence}`;
    await prisma.landingPage.create({ data: { name: `E2E Landing ${sequence}`, slug: draftSlug, createdById: admin.id } });
    const draftResponse = await visitorPage.goto(`/landing/${draftSlug}`);
    expect(draftResponse?.status()).toBe(404);

    await visitorContext.close();
  });
});
