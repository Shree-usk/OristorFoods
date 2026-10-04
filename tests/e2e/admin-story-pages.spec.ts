import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";

/** STORY-074. Serial mode: this spec's DB writes under fullyParallel otherwise contend for PGlite's single-connection local dev instance (see other admin e2e specs this session for the same precaution). */

const EMAIL_DOMAIN = "@e2e-admin-story-pages.test";
const ROLE_KEY_PREFIX = "e2e-admin-story-pages-role-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: "StoryPages"; action: "View" | "Edit" }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Story Pages Role ${sequence}` } });
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

test.describe("Admin Story Pages editor (STORY-074)", () => {
  test.describe.configure({ mode: "serial" });

  test.afterEach(async () => {
    await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });

    // These two tests mutate real, shared seeded rows (not test-scoped
    // fixtures) — restore them so the suite leaves no lasting change to
    // the live About/Contact pages.
    await prisma.storyPageBlock.updateMany({
      where: { page: "AboutUs", blockKey: "hero" },
      data: { title: "A Taste of Sri Lanka, Crafted for the World." },
    });
    await prisma.companySetting.updateMany({ where: { id: "global" }, data: { contactHeroSubcopy: null } });
  });

  test("editing the About hero headline and saving updates the real /about page", async ({ page }) => {
    const admin = await makeAdminUser([
      { module: "StoryPages", action: "View" },
      { module: "StoryPages", action: "Edit" },
    ]);
    await signIn(page, admin.email);

    await page.goto("/admin/story-pages");
    await expect(page.getByRole("heading", { name: "Page Content" })).toBeVisible();

    const headline = "E2E Edited Headline — A Taste of Sri Lanka";
    await page.locator("#hero-headline").fill(headline);
    await page.getByRole("button", { name: "Save About Page" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 1, name: headline })).toBeVisible();
  });

  test("editing the Contact hero subcopy and saving updates the real /contact-us page", async ({ page }) => {
    const admin = await makeAdminUser([
      { module: "StoryPages", action: "View" },
      { module: "StoryPages", action: "Edit" },
    ]);
    await signIn(page, admin.email);

    await page.goto("/admin/story-pages");
    await page.getByRole("tab", { name: "Contact Us" }).click();

    const subcopy = "E2E edited contact subcopy.";
    await page.getByLabel("Hero subcopy").fill(subcopy);
    await page.getByRole("button", { name: "Save Contact Page" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    await page.goto("/contact-us");
    await expect(page.getByText(subcopy)).toBeVisible();
  });

  test("a role without StoryPages permission is denied access to the editor", async ({ page }) => {
    const admin = await makeAdminUser([]);
    await signIn(page, admin.email);

    await page.goto("/admin/story-pages");
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
  });
});
