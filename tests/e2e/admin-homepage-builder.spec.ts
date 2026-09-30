import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-admin-homepage-builder.test";
const ROLE_KEY_PREFIX = "e2e-admin-homepage-builder-role-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Homepage Builder Role ${sequence}` } });
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

test.describe("Admin Homepage Builder (STORY-042)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    // HomepageLayout.createdBy uses onDelete: SetNull — deleting adminUser
    // first would null out createdById on every layout it created,
    // permanently orphaning them from this exact filter on the next run.
    // Layouts must be cleaned up before their creator is deleted.
    await prisma.homepageLayout.deleteMany({ where: { createdBy: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
    await prisma.mediaAsset.deleteMany({ where: { originalName: { startsWith: "e2e-homepage-builder-" } } });
  });

  test("build a draft, reorder via keyboard, add a hero banner from the Media Library, preview, publish, and roll back", async ({ page }) => {
    test.setTimeout(90_000);

    const admin = await makeAdminUser([
      { module: "HomepageBuilder", action: "View" },
      { module: "HomepageBuilder", action: "Edit" },
      { module: "HomepageBuilder", action: "Delete" },
      { module: "MediaLibrary", action: "View" },
    ]);

    const asset = await prisma.mediaAsset.create({
      data: {
        filename: "e2e-homepage-builder-asset.png",
        originalName: "e2e-homepage-builder-hero.png",
        url: "/images/products/misc/Bottles-group.webp",
        mimeType: "image/png",
        type: "Image",
        sizeBytes: 100,
        altText: "E2E hero test image",
      },
    });

    // A baseline Published layout to roll back to.
    const original = await prisma.homepageLayout.create({
      data: {
        status: "Published",
        publishedAt: new Date(),
        createdBy: { connect: { id: admin.id } },
        sections: {
          create: [
            {
              type: "HeroBanner",
              sortOrder: 0,
              banners: { create: [{ sortOrder: 0, headline: "E2E Original Headline", desktopImageUrl: "/images/products/misc/Bottles-group.webp", desktopImageAlt: "a" }] },
            },
            { type: "FeaturedCategories", sortOrder: 1 },
          ],
        },
      },
    });

    await signIn(page, admin.email);

    // --- Create a blank draft ---
    await page.goto("/admin/homepage-builder");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "New blank draft" }).click();
    await expect(page).toHaveURL(/\/admin\/homepage-builder\/[a-z0-9]+$/);
    const draftId = page.url().split("/").pop()!;
    await page.waitForLoadState("networkidle");

    // --- Reorder via dnd-kit's keyboard sensor: move Hero Banner down one, below Featured Categories ---
    const heroHandle = page.getByRole("button", { name: "Reorder Hero Banner" });
    await heroHandle.focus();
    await page.waitForTimeout(200);
    await page.keyboard.press("Space");
    await page.waitForTimeout(200);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(200);
    await page.keyboard.press("Space");
    await page.waitForTimeout(200);

    const rows = page.locator("li");
    await expect(rows.first()).toContainText("Featured Categories");
    await expect(rows.nth(1)).toContainText("Hero Banner");

    // --- Add a Hero Banner slide via AssetPickerDialog ---
    await page.locator("li", { hasText: "Hero Banner" }).getByRole("button", { name: "Edit" }).click();
    await page.getByRole("button", { name: "Add banner" }).click();
    await page.getByLabel("Headline", { exact: true }).fill("E2E Published Headline");
    await page.getByRole("button", { name: "Browse Library" }).first().click();
    await expect(page.getByText(asset.originalName)).toBeVisible();
    await page.getByText(asset.originalName).click();
    await expect(page.locator("#banner-desktop-image")).toHaveValue(asset.url);
    await expect(page.locator("#banner-desktop-alt")).toHaveValue(asset.altText!);
    await page.getByRole("button", { name: "Add banner" }).click();
    await expect(page.getByText("E2E Published Headline")).toBeVisible();
    await page.keyboard.press("Escape");

    // --- Preview shows the draft's content ---
    await page.getByRole("button", { name: "Preview" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("E2E Published Headline")).toBeVisible();
    await expect(page.getByText("Previewing layout (Draft)")).toBeVisible();

    // --- Publish ---
    // Only the single Draft-status row renders a "Publish" button ("New
    // draft from published" would also match a non-exact substring name).
    await page.goto("/admin/homepage-builder");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(async () => {
      const updated = await prisma.homepageLayout.findUniqueOrThrow({ where: { id: draftId } });
      expect(updated.status).toBe("Published");
    }).toPass({ timeout: 10_000 });

    // --- Storefront reflects the published layout ---
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "E2E Published Headline" })).toBeVisible();

    // --- Roll back ---
    await page.goto("/admin/homepage-builder");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Roll back" }).click();
    await expect(async () => {
      const updated = await prisma.homepageLayout.findUniqueOrThrow({ where: { id: original.id } });
      expect(updated.status).toBe("Published");
    }).toPass({ timeout: 10_000 });

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "E2E Original Headline" })).toBeVisible();
  });

  test("a Viewer-only admin can browse layouts but a mutating route denies server-side", async ({ page, request }) => {
    const viewer = await makeAdminUser([{ module: "HomepageBuilder", action: "View" }]);
    await signIn(page, viewer.email);

    await page.goto("/admin/homepage-builder");
    await expect(page.getByRole("heading", { name: "Homepage Builder" })).toBeVisible();

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    const response = await request.post("/api/admin/homepage-builder/layouts", {
      data: { cloneFromPublished: false },
      headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
    });
    expect(response.status()).toBe(403);
  });
});
