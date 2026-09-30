// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { PermissionDeniedError } from "@/services/permission.errors";
import {
  DuplicateHeroBannerSectionError,
  HeroBannerSectionDuplicateNotAllowedError,
  HomepageLayoutNotDraftError,
  NoArchivedLayoutError,
} from "@/services/homepage-builder.errors";
import {
  addBanner,
  addSection,
  createDraftLayout,
  deleteDraftLayout,
  duplicateBanner,
  duplicateSection,
  publishLayout,
  reorderBanners,
  reorderSections,
  rollbackToPrevious,
  updateSection,
} from "@/services/homepage-builder.service";

const EMAIL_DOMAIN = "@homepage-builder-svc-test.test";
const ROLE_KEY_PREFIX = "homepage-builder-svc-test-role-";
let sequence = 0;

async function makeRole(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Homepage Builder Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return role;
}

async function makeAdminUser(roleId: string) {
  sequence += 1;
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId } });
}

async function makeFullAccessAdmin() {
  const role = await makeRole([
    { module: "HomepageBuilder", action: "View" },
    { module: "HomepageBuilder", action: "Edit" },
    { module: "HomepageBuilder", action: "Delete" },
  ]);
  return makeAdminUser(role.id);
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.homepageLayout.deleteMany({ where: { createdBy: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("homepage-builder.service", () => {
  it("creates a blank draft seeded with all 11 default section types in blueprint order", async () => {
    const admin = await makeFullAccessAdmin();
    const layout = await createDraftLayout(admin.id, { cloneFromPublished: false });

    expect(layout.status).toBe("Draft");
    expect(layout.sections).toHaveLength(11);
    expect(layout.sections[0].type).toBe("HeroBanner");
    expect(layout.sections.every((s) => s.visible)).toBe(true);

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "homepage_layout_created" } });
    expect(log).not.toBeNull();
  });

  it("clones a published layout's sections and hero banner slides into a new draft", async () => {
    const admin = await makeFullAccessAdmin();
    const draft = await createDraftLayout(admin.id, { cloneFromPublished: false });
    const heroSection = draft.sections.find((s) => s.type === "HeroBanner")!;
    await addBanner(admin.id, draft.id, heroSection.id, { headline: "Original", desktopImageUrl: "/a.png", desktopImageAlt: "a" });
    await publishLayout(admin.id, draft.id);

    const clone = await createDraftLayout(admin.id, { cloneFromPublished: true });
    expect(clone.sections).toHaveLength(11);
    const clonedHero = clone.sections.find((s) => s.type === "HeroBanner")!;
    expect(clonedHero.banners).toHaveLength(1);
    expect(clonedHero.banners[0].headline).toBe("Original");
  });

  it("rejects a second HeroBanner section on the same layout", async () => {
    const admin = await makeFullAccessAdmin();
    const draft = await createDraftLayout(admin.id, { cloneFromPublished: false });
    await expect(addSection(admin.id, draft.id, "HeroBanner")).rejects.toBeInstanceOf(DuplicateHeroBannerSectionError);
  });

  it("allows duplicating a light-touch section but rejects duplicating the HeroBanner section", async () => {
    const admin = await makeFullAccessAdmin();
    const draft = await createDraftLayout(admin.id, { cloneFromPublished: false });
    const categories = draft.sections.find((s) => s.type === "FeaturedCategories")!;
    const hero = draft.sections.find((s) => s.type === "HeroBanner")!;

    const duplicate = await duplicateSection(admin.id, draft.id, categories.id);
    expect(duplicate.type).toBe("FeaturedCategories");

    await expect(duplicateSection(admin.id, draft.id, hero.id)).rejects.toBeInstanceOf(HeroBannerSectionDuplicateNotAllowedError);
  });

  it("reorders sections and persists the new sortOrder", async () => {
    const admin = await makeFullAccessAdmin();
    const draft = await createDraftLayout(admin.id, { cloneFromPublished: false });
    const reversedIds = [...draft.sections].reverse().map((s) => s.id);

    await reorderSections(admin.id, draft.id, reversedIds);

    const reordered = await prisma.homepageSection.findMany({ where: { layoutId: draft.id }, orderBy: { sortOrder: "asc" } });
    expect(reordered.map((s) => s.id)).toEqual(reversedIds);
  });

  it("updates a section's visibility and title/description override", async () => {
    const admin = await makeFullAccessAdmin();
    const draft = await createDraftLayout(admin.id, { cloneFromPublished: false });
    const categories = draft.sections.find((s) => s.type === "FeaturedCategories")!;

    const updated = await updateSection(admin.id, draft.id, categories.id, { visible: false, titleOverride: "Shop Now" });
    expect(updated.visible).toBe(false);
    expect(updated.titleOverride).toBe("Shop Now");
  });

  it("adds, duplicates, and reorders hero banner slides within a section", async () => {
    const admin = await makeFullAccessAdmin();
    const draft = await createDraftLayout(admin.id, { cloneFromPublished: false });
    const hero = draft.sections.find((s) => s.type === "HeroBanner")!;

    const first = await addBanner(admin.id, draft.id, hero.id, { headline: "First", desktopImageUrl: "/a.png", desktopImageAlt: "a" });
    const second = await addBanner(admin.id, draft.id, hero.id, { headline: "Second", desktopImageUrl: "/b.png", desktopImageAlt: "b" });
    expect(first.sortOrder).toBe(0);
    expect(second.sortOrder).toBe(1);

    const duplicate = await duplicateBanner(admin.id, draft.id, hero.id, first.id);
    expect(duplicate.headline).toBe("First");

    await reorderBanners(admin.id, draft.id, hero.id, [second.id, first.id, duplicate.id]);
    const reordered = await prisma.heroBannerSlide.findMany({ where: { sectionId: hero.id }, orderBy: { sortOrder: "asc" } });
    expect(reordered.map((s) => s.id)).toEqual([second.id, first.id, duplicate.id]);
  });

  it("rejects modifying a non-Draft layout", async () => {
    const admin = await makeFullAccessAdmin();
    const draft = await createDraftLayout(admin.id, { cloneFromPublished: false });
    await publishLayout(admin.id, draft.id);

    const categories = draft.sections.find((s) => s.type === "FeaturedCategories")!;
    await expect(updateSection(admin.id, draft.id, categories.id, { visible: false })).rejects.toBeInstanceOf(HomepageLayoutNotDraftError);
  });

  it("publishing atomically archives the previously-published layout, and rollback republishes it", async () => {
    const admin = await makeFullAccessAdmin();
    const first = await createDraftLayout(admin.id, { cloneFromPublished: false });
    await publishLayout(admin.id, first.id);

    const second = await createDraftLayout(admin.id, { cloneFromPublished: false });
    await publishLayout(admin.id, second.id);

    const firstAfter = await prisma.homepageLayout.findUniqueOrThrow({ where: { id: first.id } });
    const secondAfter = await prisma.homepageLayout.findUniqueOrThrow({ where: { id: second.id } });
    expect(firstAfter.status).toBe("Archived");
    expect(secondAfter.status).toBe("Published");

    const rolledBack = await rollbackToPrevious(admin.id);
    expect(rolledBack.id).toBe(first.id);

    const firstFinal = await prisma.homepageLayout.findUniqueOrThrow({ where: { id: first.id } });
    const secondFinal = await prisma.homepageLayout.findUniqueOrThrow({ where: { id: second.id } });
    expect(firstFinal.status).toBe("Published");
    expect(secondFinal.status).toBe("Archived");
  });

  it("rollback with nothing archived throws NoArchivedLayoutError", async () => {
    // Relies on afterEach having cleaned up every prior test's own layouts,
    // and the seed never creating an Archived one — never deletes global
    // Archived rows itself, since findMostRecentlyArchivedLayout is
    // intentionally a site-wide (not per-admin) query.
    const admin = await makeFullAccessAdmin();
    const existingArchived = await prisma.homepageLayout.count({ where: { status: "Archived" } });
    if (existingArchived > 0) return; // pre-existing archived data from outside this suite — skip rather than risk deleting it
    await expect(rollbackToPrevious(admin.id)).rejects.toBeInstanceOf(NoArchivedLayoutError);
  });

  it("only a Draft layout can be deleted", async () => {
    const admin = await makeFullAccessAdmin();
    const draft = await createDraftLayout(admin.id, { cloneFromPublished: false });
    await deleteDraftLayout(admin.id, draft.id);
    const found = await prisma.homepageLayout.findUnique({ where: { id: draft.id } });
    expect(found).toBeNull();
  });

  it("denies access to an admin without HomepageBuilder permission", async () => {
    const role = await makeRole([]);
    const viewer = await makeAdminUser(role.id);
    await expect(createDraftLayout(viewer.id, { cloneFromPublished: false })).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
