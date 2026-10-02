import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-admin-redirects.test";
const ROLE_KEY_PREFIX = "e2e-admin-redirects-role-";
const PATH_PREFIX = "/e2e-admin-redirects-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Admin Redirects Role ${sequence}` } });
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

test.describe("Admin Redirect Manager (STORY-051b)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.redirect.deleteMany({ where: { sourcePath: { startsWith: PATH_PREFIX } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test("a View-only admin cannot create; a full-access admin creates one through the real console, and a real storefront visitor is actually redirected", async ({ page, browser }) => {
    test.setTimeout(60_000);

    const viewer = await makeAdminUser([{ module: "SEO", action: "View" }]);
    const admin = await makeAdminUser([
      { module: "SEO", action: "View" },
      { module: "SEO", action: "Edit" },
    ]);

    sequence += 1;
    const source = `${PATH_PREFIX}${sequence}`;

    // The View-only admin's create attempt is rejected server-side (403).
    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();
    await signIn(viewerPage, viewer.email);
    const deniedResponse = await viewerContext.request.post("/api/admin/seo/redirects", {
      headers: { "Content-Type": "application/json" },
      data: { sourcePath: source, destinationPath: "/products", statusCode: 301, active: true },
    });
    expect(deniedResponse.status()).toBe(403);
    await viewerContext.close();

    // The full-access admin creates it through the real console.
    await signIn(page, admin.email);
    await page.goto("/admin/seo/redirects/new");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Source path").fill(source);
    await page.getByLabel("Destination path").fill("/products");
    await page.getByRole("combobox", { name: "Status code", exact: true }).click();
    await page.getByRole("option", { name: "302", exact: false }).click();
    await page.getByRole("button", { name: "Create", exact: true }).click();
    // "new" itself would also match a bare [a-z0-9]+ pattern — require the cuid's leading "c" to exclude it.
    await expect(page).toHaveURL(/\/admin\/seo\/redirects\/c[a-z0-9]+$/, { timeout: 15_000 });

    // proxy.ts resolves redirects from a 10s-TTL cache (src/lib/redirect-cache.ts)
    // that's never eagerly invalidated across the middleware/route-handler
    // bundle boundary — wait out the TTL so this assertion reflects real,
    // eventual behavior rather than a lucky cold-cache race.
    await page.waitForTimeout(11_000);

    // A real, separate storefront visitor hitting the old path is actually redirected.
    const visitorContext = await browser.newContext();
    const visitorPage = await visitorContext.newPage();
    const response = await visitorPage.goto(source);
    await expect(visitorPage).toHaveURL(/\/products$/);
    expect(response?.request().redirectedFrom()).not.toBeNull();
    await visitorContext.close();
  });
});
