// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { checkInternalPath, checkMenuLinks } from "@/services/link-check.service";

const SKU_PREFIX = "LINK-CHECK-SVC-";
const SLUG_PREFIX = "link-check-svc-";
const EMAIL_DOMAIN = "@link-check-svc-test.test";
const ROLE_KEY_PREFIX = "link-check-svc-role-";
let sequence = 0;

async function makeAdmin() {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Link Check Svc Test Role ${sequence}` } });
  await prisma.rolePermission.create({ data: { roleId: role.id, module: "Navigation", action: "View" } });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

afterEach(async () => {
  await prisma.menuItem.deleteMany({});
  await prisma.menu.deleteMany({});
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("link-check.service — checkInternalPath", () => {
  it("accepts a known static route, including with a query string", async () => {
    expect(await checkInternalPath("/products")).toBe(true);
    expect(await checkInternalPath("/products?collection=best-sellers")).toBe(true);
  });

  it("accepts a real product's own detail path via the sitemap", async () => {
    sequence += 1;
    const slug = `${SLUG_PREFIX}product-${sequence}`;
    await prisma.product.create({ data: { sku: `${SKU_PREFIX}${sequence}`, slug, name: `Link Check Svc Product ${sequence}`, status: "Published" } });

    expect(await checkInternalPath(`/products/${slug}`)).toBe(true);
  });

  it("rejects a path that matches nothing", async () => {
    expect(await checkInternalPath("/this-page-does-not-exist")).toBe(false);
  });
});

describe("link-check.service — checkMenuLinks", () => {
  it("checks every item, using the injected external checker instead of a real network call", async () => {
    const admin = await makeAdmin();
    const menu = await prisma.menu.create({ data: { location: "Mobile" } });
    const goodInternal = await prisma.menuItem.create({ data: { menuId: menu.id, sortOrder: 0, label: "Products", linkType: "Internal", internalPath: "/products" } });
    const badInternal = await prisma.menuItem.create({ data: { menuId: menu.id, sortOrder: 1, label: "Broken", linkType: "Internal", internalPath: "/nowhere" } });
    const goodExternal = await prisma.menuItem.create({ data: { menuId: menu.id, sortOrder: 2, label: "Partner", linkType: "External", externalUrl: "https://partner.example.com" } });
    const badExternal = await prisma.menuItem.create({ data: { menuId: menu.id, sortOrder: 3, label: "Dead link", linkType: "External", externalUrl: "https://dead.example.com" } });

    const fakeChecker = async (url: string) => url === goodExternal.externalUrl;

    const results = await checkMenuLinks(admin.id, menu.id, fakeChecker);
    const byId = (id: string) => results.find((r) => r.itemId === id);

    expect(byId(goodInternal.id)?.ok).toBe(true);
    expect(byId(badInternal.id)?.ok).toBe(false);
    expect(byId(goodExternal.id)?.ok).toBe(true);
    expect(byId(badExternal.id)?.ok).toBe(false);
    expect(byId(badExternal.id)?.reason).toContain("dead.example.com");
  });
});
