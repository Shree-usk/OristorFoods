// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { addItem, getDraftMenu, getResolvedFooterColumns, getResolvedHeaderItems, getResolvedMobileDrawerItems, publishMenu, reorderItems, reparentItem, rollbackMenu, updateItem } from "@/services/navigation.service";
import { primaryNavItems } from "@/lib/nav-config";
import { footerColumns } from "@/lib/footer-config";
import { InvalidLinkTargetError, MaxDepthExceededError, NoArchivedMenuError } from "@/services/navigation.errors";

const EMAIL_DOMAIN = "@nav-svc-test.test";
const ROLE_KEY_PREFIX = "nav-svc-test-role-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Nav Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

async function makeFullAccessAdmin() {
  return makeAdmin([
    { module: "Navigation", action: "View" },
    { module: "Navigation", action: "Edit" },
    { module: "Navigation", action: "Delete" },
  ]);
}

afterEach(async () => {
  await prisma.menuItem.deleteMany({});
  await prisma.menu.deleteMany({});
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

const BASE_ITEM = {
  label: "Item",
  linkType: "Internal" as const,
  internalPath: "/products",
  externalUrl: null,
  openInNewTab: false,
  icon: null,
  visibility: "Always" as const,
  targetCustomerGroup: null,
  active: true,
  contentBlockType: "Link" as const,
  promoImageUrl: null,
  promoImageAlt: null,
  promoHeading: null,
  promoCtaLabel: null,
};

describe("navigation.service — max nesting depth per location", () => {
  it("allows Header to nest 2 levels deep (top item -> section -> link) but rejects a 3rd", async () => {
    const admin = await makeFullAccessAdmin();
    const menu = await getDraftMenu(admin.id, "Header");

    const top = await addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: null, label: "Products", linkType: "None", internalPath: null });
    const section = await addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: top.id, label: "Shop", linkType: "None", internalPath: null });
    const link = await addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: section.id, label: "All Products" });
    expect(link.parentId).toBe(section.id);

    await expect(addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: link.id, label: "Too deep" })).rejects.toBeInstanceOf(MaxDepthExceededError);
  });

  it("allows Footer to nest 1 level deep (column -> link) but rejects a 2nd", async () => {
    const admin = await makeFullAccessAdmin();
    const menu = await getDraftMenu(admin.id, "Footer");

    const column = await addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: null, label: "Shop", linkType: "None", internalPath: null });
    const link = await addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: column.id, label: "Products" });

    await expect(addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: link.id, label: "Too deep" })).rejects.toBeInstanceOf(MaxDepthExceededError);
  });

  it("keeps Mobile flat — any child is rejected", async () => {
    const admin = await makeFullAccessAdmin();
    const menu = await getDraftMenu(admin.id, "Mobile");

    const top = await addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: null, label: "Food Academy" });

    await expect(addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: top.id, label: "Too deep" })).rejects.toBeInstanceOf(MaxDepthExceededError);
  });
});

describe("navigation.service — link target validation", () => {
  it("rejects Internal with no internalPath, External with no externalUrl, and None with either set", async () => {
    const admin = await makeFullAccessAdmin();
    const menu = await getDraftMenu(admin.id, "Mobile");

    await expect(addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: null, linkType: "Internal", internalPath: null })).rejects.toBeInstanceOf(InvalidLinkTargetError);
    await expect(addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: null, linkType: "External", internalPath: null, externalUrl: null })).rejects.toBeInstanceOf(InvalidLinkTargetError);
    await expect(addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: null, linkType: "None", internalPath: "/products" })).rejects.toBeInstanceOf(InvalidLinkTargetError);
  });

  it("re-validates on update using the merged (existing + patch) link type and target", async () => {
    const admin = await makeFullAccessAdmin();
    const menu = await getDraftMenu(admin.id, "Mobile");
    const item = await addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: null });

    await expect(updateItem(admin.id, menu.id, item.id, { linkType: "External" })).rejects.toBeInstanceOf(InvalidLinkTargetError);

    const updated = await updateItem(admin.id, menu.id, item.id, { linkType: "External", internalPath: null, externalUrl: "https://example.com" });
    expect(updated.externalUrl).toBe("https://example.com");
    expect(updated.internalPath).toBeNull();
  });
});

describe("navigation.service — reorderItems / reparentItem", () => {
  it("rewrites sortOrder for a set of siblings to match the given order", async () => {
    const admin = await makeFullAccessAdmin();
    const menu = await getDraftMenu(admin.id, "Mobile");
    const a = await addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: null, label: "A" });
    const b = await addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: null, label: "B" });
    const c = await addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: null, label: "C" });

    await reorderItems(admin.id, menu.id, null, [c.id, a.id, b.id]);

    const reordered = await prisma.menuItem.findMany({ where: { menuId: menu.id }, orderBy: { sortOrder: "asc" } });
    expect(reordered.map((item) => item.label)).toEqual(["C", "A", "B"]);
  });

  it("moves an item into a different container when the result still fits that location's max depth", async () => {
    const admin = await makeFullAccessAdmin();
    const menu = await getDraftMenu(admin.id, "Header");
    const topA = await addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: null, label: "A", linkType: "None", internalPath: null });
    const topB = await addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: null, label: "B", linkType: "None", internalPath: null });
    const sectionUnderA = await addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: topA.id, label: "Section", linkType: "None", internalPath: null });

    // Moving a depth-1 section from under topA to under topB is still depth 1 there — fine.
    await reparentItem(admin.id, menu.id, sectionUnderA.id, topB.id);
    const moved = await prisma.menuItem.findUnique({ where: { id: sectionUnderA.id } });
    expect(moved?.parentId).toBe(topB.id);
  });

  it("rejects reparenting a depth-2 item under another depth-2 item, since that would make it depth 3", async () => {
    const admin = await makeFullAccessAdmin();
    const menu = await getDraftMenu(admin.id, "Header");
    const top = await addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: null, label: "Top", linkType: "None", internalPath: null });
    const sectionOne = await addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: top.id, label: "Section One", linkType: "None", internalPath: null });
    const sectionTwo = await addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: top.id, label: "Section Two", linkType: "None", internalPath: null });
    const linkInSectionOne = await addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: sectionOne.id, label: "Link" });
    const linkInSectionTwo = await addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: sectionTwo.id, label: "Other link" });

    await expect(reparentItem(admin.id, menu.id, linkInSectionOne.id, linkInSectionTwo.id)).rejects.toBeInstanceOf(MaxDepthExceededError);
  });
});

describe("navigation.service — publish / rollback", () => {
  it("archives the previously-Published menu for the same location, but leaves a different location's published menu untouched", async () => {
    const admin = await makeFullAccessAdmin();

    const headerDraft1 = await getDraftMenu(admin.id, "Header");
    const headerPublished1 = await publishMenu(admin.id, headerDraft1.id);
    expect(headerPublished1.status).toBe("Published");

    const footerDraft = await getDraftMenu(admin.id, "Footer");
    const footerPublished = await publishMenu(admin.id, footerDraft.id);

    // A new Draft auto-vivifies for Header since the old one is now Published.
    const headerDraft2 = await getDraftMenu(admin.id, "Header");
    expect(headerDraft2.id).not.toBe(headerDraft1.id);
    const headerPublished2 = await publishMenu(admin.id, headerDraft2.id);

    const archivedFirst = await prisma.menu.findUnique({ where: { id: headerPublished1.id } });
    expect(archivedFirst?.status).toBe("Archived");
    expect(headerPublished2.status).toBe("Published");

    const footerStillPublished = await prisma.menu.findUnique({ where: { id: footerPublished.id } });
    expect(footerStillPublished?.status).toBe("Published");
  });

  it("rolls back to the most-recently-Archived menu for a location", async () => {
    const admin = await makeFullAccessAdmin();

    const draft1 = await getDraftMenu(admin.id, "Mobile");
    const published1 = await publishMenu(admin.id, draft1.id);

    const draft2 = await getDraftMenu(admin.id, "Mobile");
    await publishMenu(admin.id, draft2.id);

    const rolledBack = await rollbackMenu(admin.id, "Mobile");
    expect(rolledBack.id).toBe(published1.id);
    expect(rolledBack.status).toBe("Published");
  });

  it("throws NoArchivedMenuError when there's nothing to roll back to", async () => {
    const admin = await makeFullAccessAdmin();
    await expect(rollbackMenu(admin.id, "Header")).rejects.toBeInstanceOf(NoArchivedMenuError);
  });
});

describe("navigation.service — storefront resolution (getResolvedHeaderItems / Footer / MobileDrawer)", () => {
  it("falls back to the static nav-config.ts/footer-config.ts arrays until something's been published", async () => {
    expect(await getResolvedHeaderItems()).toBe(primaryNavItems);
    expect(await getResolvedFooterColumns()).toBe(footerColumns);
  });

  it("maps a published Header menu's nested tree into NavItem[] with a mega-menu section, a plain link, and a promo tile", async () => {
    const admin = await makeFullAccessAdmin();
    const menu = await getDraftMenu(admin.id, "Header");
    const top = await addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: null, label: "Products", linkType: "Internal", internalPath: "/products" });
    const section = await addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: top.id, label: "Shop", linkType: "None", internalPath: null });
    await addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: section.id, label: "All Products", linkType: "Internal", internalPath: "/products" });
    await addItem(admin.id, menu.id, {
      ...BASE_ITEM,
      parentId: section.id,
      label: "Promo",
      linkType: "Internal",
      internalPath: "/products?collection=best-sellers",
      contentBlockType: "PromoTile",
      promoImageUrl: "/images/promo.jpg",
      promoImageAlt: "Promo",
      promoHeading: "Best sellers",
      promoCtaLabel: "Shop now",
    });
    await publishMenu(admin.id, menu.id);

    const resolved = await getResolvedHeaderItems();
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.label).toBe("Products");
    expect(resolved[0]?.megaMenu).toHaveLength(1);
    expect(resolved[0]?.megaMenu?.[0]?.heading).toBe("Shop");
    expect(resolved[0]?.megaMenu?.[0]?.links).toEqual([{ label: "All Products", href: "/products" }]);
    expect(resolved[0]?.megaMenu?.[0]?.promoTile).toEqual({
      imageUrl: "/images/promo.jpg",
      imageAlt: "Promo",
      heading: "Best sellers",
      ctaLabel: "Shop now",
      ctaHref: "/products?collection=best-sellers",
    });
  });

  it("maps a published Footer menu's columns, and a published Mobile menu's flat items", async () => {
    const admin = await makeFullAccessAdmin();
    const footerMenu = await getDraftMenu(admin.id, "Footer");
    const column = await addItem(admin.id, footerMenu.id, { ...BASE_ITEM, parentId: null, label: "Shop", linkType: "None", internalPath: null });
    await addItem(admin.id, footerMenu.id, { ...BASE_ITEM, parentId: column.id, label: "Products", linkType: "Internal", internalPath: "/products" });
    await publishMenu(admin.id, footerMenu.id);

    const resolvedFooter = await getResolvedFooterColumns();
    expect(resolvedFooter).toEqual([{ heading: "Shop", links: [{ label: "Products", href: "/products" }] }]);

    const mobileMenu = await getDraftMenu(admin.id, "Mobile");
    await addItem(admin.id, mobileMenu.id, { ...BASE_ITEM, parentId: null, label: "Export", linkType: "Internal", internalPath: "/export" });
    await publishMenu(admin.id, mobileMenu.id);

    const resolvedMobile = await getResolvedMobileDrawerItems();
    expect(resolvedMobile).toEqual([{ label: "Export", href: "/export", icon: undefined }]);
  });

  it("excludes an inactive item from the resolved output", async () => {
    const admin = await makeFullAccessAdmin();
    const menu = await getDraftMenu(admin.id, "Mobile");
    await addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: null, label: "Active", active: true });
    await addItem(admin.id, menu.id, { ...BASE_ITEM, parentId: null, label: "Inactive", active: false });
    await publishMenu(admin.id, menu.id);

    const resolved = await getResolvedMobileDrawerItems();
    expect(resolved.map((item) => item.label)).toEqual(["Active"]);
  });
});
