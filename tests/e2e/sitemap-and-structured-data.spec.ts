import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";

const EMAIL_DOMAIN = "@e2e-sitemap-seo.test";
const ROLE_KEY_PREFIX = "e2e-sitemap-seo-role-";
const SKU_PREFIX = "E2E-SITEMAP-SEO-";
const PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeAdminUser(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `E2E Sitemap SEO Role ${sequence}` } });
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

test.describe("Sitemap, robots.txt, and structured data (STORY-051c)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.seoMeta.deleteMany({ where: { entityId: { in: await prisma.product.findMany({ where: { sku: { startsWith: SKU_PREFIX } }, select: { id: true } }).then((rows) => rows.map((r) => r.id)) } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
    await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  });

  test("robots.txt has the expected disallow rules and sitemap pointer", async ({ page }) => {
    const response = await page.goto("/robots.txt");
    const body = (await response?.text()) ?? "";
    expect(body).toContain("Disallow: /admin");
    expect(body).toContain("Disallow: /account");
    expect(body).toMatch(/Sitemap: .*\/sitemap\.xml/);
  });

  test("a published product appears in the sitemap, disappears once its SEO panel turns indexing off, and a custom JSON-LD override renders on the real storefront page", async ({ page }) => {
    test.setTimeout(60_000);

    const admin = await makeAdminUser([
      { module: "Products", action: "View" },
      { module: "Products", action: "Edit" },
      { module: "SEO", action: "View" },
      { module: "SEO", action: "Edit" },
    ]);

    sequence += 1;
    const slug = `e2e-sitemap-seo-${sequence}`;
    const sku = `${SKU_PREFIX}${sequence}`;
    const product = await prisma.product.create({ data: { sku, slug, name: `E2E Sitemap SEO Product ${sequence}`, status: "Published" } });

    const sitemapBefore = (await (await page.goto("/sitemap.xml"))?.text()) ?? "";
    expect(sitemapBefore).toContain(`/products/${slug}`);

    await signIn(page, admin.email);
    await page.goto(`/admin/products/${product.id}`);
    await page.waitForLoadState("networkidle");

    // A Published product with no resolvable price renders as not-found on
    // the storefront (getProductDetail's own guard) — set one so the later
    // PDP visit actually renders.
    await page.getByRole("tab", { name: "Pricing" }).click();
    await page.getByLabel("New price").fill("500");
    await page.getByRole("button", { name: "Set price" }).click();
    await expect(page.getByText("Current: LKR 500")).toBeVisible();

    await page.getByRole("tab", { name: "SEO" }).click();

    // Turn indexing off — the sitemap must no longer list this product.
    await page.getByRole("checkbox", { name: "Index (show in search results)" }).click();

    const overrideJson = JSON.stringify({ "@context": "https://schema.org", "@type": "Product", name: "E2E Custom Override Name" });
    await page.getByLabel("Advanced: custom structured data (JSON-LD)").fill(overrideJson);
    await page.getByRole("button", { name: "Save SEO fields" }).click();
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible();

    const sitemapAfter = (await (await page.goto("/sitemap.xml"))?.text()) ?? "";
    expect(sitemapAfter).not.toContain(`/products/${slug}`);

    // A real, separate storefront visitor sees the custom JSON-LD, not the
    // auto-generated ProductJsonLd — the page also renders a sitewide
    // Organization script (root layout), so check every ld+json script
    // tag for the override rather than assuming a fixed position.
    const visitorContext = await page.context().browser()!.newContext();
    const visitorPage = await visitorContext.newPage();
    await visitorPage.goto(`/products/${slug}`);
    const scriptContents = await visitorPage.locator('script[type="application/ld+json"]').allTextContents();
    const parsed = scriptContents.map((text) => JSON.parse(text));
    expect(parsed).toContainEqual(expect.objectContaining({ name: "E2E Custom Override Name" }));
    expect(parsed.some((entry) => entry["@type"] === "Product" && entry.sku)).toBe(false);
    await visitorContext.close();
  });
});
