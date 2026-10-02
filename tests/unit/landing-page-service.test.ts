// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { PermissionDeniedError } from "@/services/permission.errors";
import { IllegalLandingPageStatusTransitionError, LandingPageNotFoundError, LandingPageSlugTakenError } from "@/services/landing-page.errors";
import {
  changeLandingPageStatus,
  createBlock,
  createLandingPage,
  deleteBlock,
  getLandingPageAdminDetail,
  getPublishedLandingPageBySlug,
  listLandingPagesForAdmin,
  reorderBlocks,
  updateBlock,
  updateLandingPage,
} from "@/services/landing-page.service";

const EMAIL_DOMAIN = "@lp-svc-test.test";
const ROLE_KEY_PREFIX = "lp-svc-test-role-";
const SLUG_PREFIX = "lp-svc-test-";
let sequence = 0;

async function makeRole(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `LP Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return role;
}

async function makeAdminUser(roleId: string) {
  sequence += 1;
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId } });
}

async function makeFullAccessAdmin() {
  const role = await makeRole([
    { module: "Marketing", action: "View" },
    { module: "Marketing", action: "Edit" },
    { module: "Marketing", action: "Approve" },
  ]);
  return makeAdminUser(role.id);
}

async function makeEditOnlyAdmin() {
  const role = await makeRole([
    { module: "Marketing", action: "View" },
    { module: "Marketing", action: "Edit" },
  ]);
  return makeAdminUser(role.id);
}

function nextSlug() {
  sequence += 1;
  return `${SLUG_PREFIX}${sequence}`;
}

const blockInput = {
  subheadline: null,
  supportingText: null,
  ctaLabel: "Shop now",
  ctaHref: "/products",
  secondaryCtaLabel: null,
  secondaryCtaHref: null,
  desktopImageUrl: "https://example.com/hero.jpg",
  desktopImageAlt: "Hero",
  mobileImageUrl: null,
  mobileImageAlt: null,
  videoUrl: null,
  overlayEnabled: false,
  alignment: "Left" as const,
};

afterEach(async () => {
  await prisma.landingPageBlock.deleteMany({ where: { landingPage: { slug: { startsWith: SLUG_PREFIX } } } });
  await prisma.landingPage.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("landing-page.service: CRUD + permissions", () => {
  it("creates a landing page and writes an audit log entry", async () => {
    const admin = await makeFullAccessAdmin();
    const slug = nextSlug();
    const landingPage = await createLandingPage(admin.id, { name: "October Sale", slug, metaTitle: null, metaDescription: null });
    expect(landingPage.slug).toBe(slug);
    expect(landingPage.status).toBe("Draft");

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "landing_page_created", targetId: landingPage.id } });
    expect(log).not.toBeNull();
  });

  it("rejects a duplicate slug", async () => {
    const admin = await makeFullAccessAdmin();
    const slug = nextSlug();
    await createLandingPage(admin.id, { name: "First", slug, metaTitle: null, metaDescription: null });
    await expect(createLandingPage(admin.id, { name: "Second", slug, metaTitle: null, metaDescription: null })).rejects.toBeInstanceOf(LandingPageSlugTakenError);
  });

  it("a View-only admin cannot create but can list", async () => {
    const role = await makeRole([{ module: "Marketing", action: "View" }]);
    const admin = await makeAdminUser(role.id);
    await expect(createLandingPage(admin.id, { name: "x", slug: nextSlug(), metaTitle: null, metaDescription: null })).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(listLandingPagesForAdmin(admin.id)).resolves.toBeInstanceOf(Array);
  });

  it("updates page content", async () => {
    const admin = await makeFullAccessAdmin();
    const landingPage = await createLandingPage(admin.id, { name: "Original", slug: nextSlug(), metaTitle: null, metaDescription: null });
    const updated = await updateLandingPage(admin.id, landingPage.id, { name: "Renamed", metaTitle: "SEO Title" });
    expect(updated.name).toBe("Renamed");
    expect(updated.metaTitle).toBe("SEO Title");
  });

  it("404s for a nonexistent landing page id", async () => {
    const admin = await makeFullAccessAdmin();
    await expect(getLandingPageAdminDetail(admin.id, "nonexistent-id")).rejects.toBeInstanceOf(LandingPageNotFoundError);
  });
});

describe("landing-page.service: blocks", () => {
  it("creates, updates, reorders, and deletes blocks", async () => {
    const admin = await makeFullAccessAdmin();
    const landingPage = await createLandingPage(admin.id, { name: "Blocks Test", slug: nextSlug(), metaTitle: null, metaDescription: null });

    const first = await createBlock(admin.id, landingPage.id, { ...blockInput, headline: "First" });
    const second = await createBlock(admin.id, landingPage.id, { ...blockInput, headline: "Second" });
    expect(first.sortOrder).toBe(0);
    expect(second.sortOrder).toBe(1);

    const updated = await updateBlock(admin.id, first.id, { headline: "First Updated", visible: false });
    expect(updated.headline).toBe("First Updated");
    expect(updated.visible).toBe(false);

    await reorderBlocks(admin.id, landingPage.id, [second.id, first.id]);
    const detail = await getLandingPageAdminDetail(admin.id, landingPage.id);
    expect(detail.blocks.map((block) => block.id)).toEqual([second.id, first.id]);

    await deleteBlock(admin.id, first.id);
    const afterDelete = await getLandingPageAdminDetail(admin.id, landingPage.id);
    expect(afterDelete.blocks).toHaveLength(1);
  });
});

describe("landing-page.service: status workflow", () => {
  it("an Edit-only admin can archive but cannot publish", async () => {
    const admin = await makeEditOnlyAdmin();
    const full = await makeFullAccessAdmin();
    const landingPage = await createLandingPage(full.id, { name: "Status Test", slug: nextSlug(), metaTitle: null, metaDescription: null });

    await expect(changeLandingPageStatus(admin.id, landingPage.id, "Published")).rejects.toBeInstanceOf(PermissionDeniedError);
    const archived = await changeLandingPageStatus(admin.id, landingPage.id, "Archived");
    expect(archived.status).toBe("Archived");
  });

  it("publishing requires Approve and sets publishedAt", async () => {
    const admin = await makeFullAccessAdmin();
    const landingPage = await createLandingPage(admin.id, { name: "Publish Test", slug: nextSlug(), metaTitle: null, metaDescription: null });
    const published = await changeLandingPageStatus(admin.id, landingPage.id, "Published");
    expect(published.status).toBe("Published");
    expect(published.publishedAt).not.toBeNull();
  });

  it("rejects an illegal transition", async () => {
    const admin = await makeFullAccessAdmin();
    const landingPage = await createLandingPage(admin.id, { name: "Illegal Test", slug: nextSlug(), metaTitle: null, metaDescription: null });
    await changeLandingPageStatus(admin.id, landingPage.id, "Published");
    await expect(changeLandingPageStatus(admin.id, landingPage.id, "Draft")).rejects.toBeInstanceOf(IllegalLandingPageStatusTransitionError);
  });
});

describe("landing-page.service: storefront read", () => {
  it("returns null for a Draft or Archived page, and the real visible blocks in order for a Published one", async () => {
    const admin = await makeFullAccessAdmin();
    const slug = nextSlug();
    const landingPage = await createLandingPage(admin.id, { name: "Storefront Test", slug, metaTitle: null, metaDescription: null });
    await createBlock(admin.id, landingPage.id, { ...blockInput, headline: "Visible One" });
    const hidden = await createBlock(admin.id, landingPage.id, { ...blockInput, headline: "Hidden" });
    await updateBlock(admin.id, hidden.id, { visible: false });
    await createBlock(admin.id, landingPage.id, { ...blockInput, headline: "Visible Two" });

    expect(await getPublishedLandingPageBySlug(slug)).toBeNull();

    await changeLandingPageStatus(admin.id, landingPage.id, "Published");
    const published = await getPublishedLandingPageBySlug(slug);
    expect(published?.blocks.map((block) => block.headline)).toEqual(["Visible One", "Visible Two"]);

    await changeLandingPageStatus(admin.id, landingPage.id, "Archived");
    expect(await getPublishedLandingPageBySlug(slug)).toBeNull();
  });
});
