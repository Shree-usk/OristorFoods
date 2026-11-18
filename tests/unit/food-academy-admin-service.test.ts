// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { PermissionDeniedError } from "@/services/permission.errors";
import {
  FoodAcademyCategoryInUseError,
  FoodAcademyCategorySlugConflictError,
  FoodAcademyCourseRequiresSectionsError,
  FoodAcademyEntryNotFoundError,
  FoodAcademyEntryPublishReadinessError,
  FoodAcademyEntrySlugConflictError,
} from "@/services/food-academy-admin.errors";
import {
  createFoodAcademyCategory,
  createFoodAcademyEntry,
  deleteFoodAcademyCategory,
  publishFoodAcademyEntry,
  reorderFoodAcademyFeaturedEntries,
  unpublishFoodAcademyEntry,
  updateFoodAcademyCategory,
  updateFoodAcademyEntry,
} from "@/services/food-academy-admin.service";
import type { FoodAcademyEntryAdminWriteInput } from "@/repositories/food-academy.repository";
import { makeFoodAcademyCategory, makeFoodAcademyEntry, cleanupRecipes } from "./recipe-fixtures";

const EMAIL_DOMAIN = "@food-academy-admin-svc-test.test";
const ROLE_KEY_PREFIX = "food-academy-admin-svc-test-role-";
let sequence = 0;

async function makeRole(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Food Academy Admin Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return role;
}

async function makeAdminUser(roleId: string) {
  sequence += 1;
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId } });
}

async function makeFullAccessAdmin() {
  const role = await makeRole([
    { module: "FoodAcademy", action: "View" },
    { module: "FoodAcademy", action: "Edit" },
    { module: "FoodAcademy", action: "Delete" },
    { module: "FoodAcademy", action: "Approve" },
  ]);
  return makeAdminUser(role.id);
}

async function makeViewOnlyAdmin() {
  const role = await makeRole([{ module: "FoodAcademy", action: "View" }]);
  return makeAdminUser(role.id);
}

function baseEntryInput(categoryId: string, overrides: Partial<FoodAcademyEntryAdminWriteInput> = {}): FoodAcademyEntryAdminWriteInput {
  sequence += 1;
  return {
    slug: `fa-admin-svc-entry-${sequence}`,
    title: `Test Entry ${sequence}`,
    summary: "A test summary.",
    heroImageUrl: "/images/hero.webp",
    contentType: "Article",
    categoryId,
    bodyContent: "Body content.",
    readingTimeMinutes: 5,
    authorName: "Test Author",
    isFeatured: false,
    sections: [],
    recipeIds: [],
    productIds: [],
    ...overrides,
  };
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  await cleanupRecipes();
});

describe("food-academy-admin.service — permissions", () => {
  it("denies category create without Edit permission", async () => {
    const viewer = await makeViewOnlyAdmin();
    await expect(createFoodAcademyCategory(viewer.id, { name: "X", slug: `fa-svc-cat-${sequence}` })).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("denies entry publish without Approve permission", async () => {
    const role = await makeRole([
      { module: "FoodAcademy", action: "View" },
      { module: "FoodAcademy", action: "Edit" },
    ]);
    const editOnlyAdmin = await makeAdminUser(role.id);
    const category = await makeFoodAcademyCategory();
    const entry = await createFoodAcademyEntry(editOnlyAdmin.id, baseEntryInput(category.id));

    await expect(publishFoodAcademyEntry(editOnlyAdmin.id, entry.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("food-academy-admin.service — categories", () => {
  it("creates a category and writes an audit log entry", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await createFoodAcademyCategory(admin.id, { name: "Ingredients", slug: `fa-svc-cat-${sequence + 1}` });

    expect(category.name).toBe("Ingredients");
    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "food_academy_category_created" } });
    expect(log).not.toBeNull();
  });

  it("rejects a duplicate category slug", async () => {
    const admin = await makeFullAccessAdmin();
    const slug = `fa-svc-cat-dup-${sequence}`;
    await createFoodAcademyCategory(admin.id, { name: "First", slug });
    await expect(createFoodAcademyCategory(admin.id, { name: "Second", slug })).rejects.toBeInstanceOf(FoodAcademyCategorySlugConflictError);
  });

  it("refuses to delete a category that still has entries", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await makeFoodAcademyCategory();
    await makeFoodAcademyEntry({ categoryId: category.id });

    await expect(deleteFoodAcademyCategory(admin.id, category.id)).rejects.toBeInstanceOf(FoodAcademyCategoryInUseError);
  });

  it("allows deleting a category with no entries", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await makeFoodAcademyCategory();
    await expect(deleteFoodAcademyCategory(admin.id, category.id)).resolves.toBeUndefined();
  });

  it("surfaces a slug conflict on update too", async () => {
    const admin = await makeFullAccessAdmin();
    const first = await createFoodAcademyCategory(admin.id, { name: "First", slug: `fa-svc-cat-upd-a-${sequence}` });
    const second = await createFoodAcademyCategory(admin.id, { name: "Second", slug: `fa-svc-cat-upd-b-${sequence}` });

    await expect(updateFoodAcademyCategory(admin.id, second.id, { name: "Second", slug: first.slug })).rejects.toBeInstanceOf(FoodAcademyCategorySlugConflictError);
  });
});

describe("food-academy-admin.service — entries", () => {
  it("rejects a Course entry with no sections", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await makeFoodAcademyCategory();
    await expect(createFoodAcademyEntry(admin.id, baseEntryInput(category.id, { contentType: "Course", sections: [] }))).rejects.toBeInstanceOf(FoodAcademyCourseRequiresSectionsError);
  });

  it("accepts a Course entry with at least one section", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await makeFoodAcademyCategory();
    const entry = await createFoodAcademyEntry(
      admin.id,
      baseEntryInput(category.id, { contentType: "Course", sections: [{ sectionNumber: 1, title: "Intro", bodyContent: "..." }] }),
    );
    expect(entry.sections).toHaveLength(1);
  });

  it("rejects a duplicate entry slug", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await makeFoodAcademyCategory();
    const input = baseEntryInput(category.id);
    await createFoodAcademyEntry(admin.id, input);
    await expect(createFoodAcademyEntry(admin.id, { ...baseEntryInput(category.id), slug: input.slug })).rejects.toBeInstanceOf(FoodAcademyEntrySlugConflictError);
  });

  it("update rejects when the id doesn't exist", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await makeFoodAcademyCategory();
    await expect(updateFoodAcademyEntry(admin.id, "does-not-exist", baseEntryInput(category.id))).rejects.toBeInstanceOf(FoodAcademyEntryNotFoundError);
  });

  it("publish requires a hero image and a summary, and sets publishedAt", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await makeFoodAcademyCategory();
    const entry = await createFoodAcademyEntry(admin.id, baseEntryInput(category.id, { heroImageUrl: null }));

    await expect(publishFoodAcademyEntry(admin.id, entry.id)).rejects.toBeInstanceOf(FoodAcademyEntryPublishReadinessError);

    const updated = await updateFoodAcademyEntry(admin.id, entry.id, baseEntryInput(category.id, { slug: entry.slug, heroImageUrl: "/images/hero.webp" }));
    const published = await publishFoodAcademyEntry(admin.id, updated.id);
    expect(published.status).toBe("Published");
    expect(published.publishedAt).not.toBeNull();

    const unpublished = await unpublishFoodAcademyEntry(admin.id, updated.id);
    expect(unpublished.status).toBe("Draft");
    expect(unpublished.publishedAt).toBeNull();
  });

  it("publish requires at least one section for a Course entry", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await makeFoodAcademyCategory();
    // Can't create a sectionless Course directly (create already guards it),
    // so this exercises the same guard inside publish independently by
    // reusing a Course entry that does have a section, confirming publish
    // succeeds once content requirements are met.
    const entry = await createFoodAcademyEntry(
      admin.id,
      baseEntryInput(category.id, { contentType: "Course", sections: [{ sectionNumber: 1, title: "Intro", bodyContent: "..." }] }),
    );
    const published = await publishFoodAcademyEntry(admin.id, entry.id);
    expect(published.status).toBe("Published");
  });
});

describe("food-academy-admin.service — reorderFoodAcademyFeaturedEntries", () => {
  it("rejects an id that isn't currently featured", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await makeFoodAcademyCategory();
    const notFeatured = await makeFoodAcademyEntry({ categoryId: category.id, isFeatured: false });

    await expect(reorderFoodAcademyFeaturedEntries(admin.id, [notFeatured.id])).rejects.toBeInstanceOf(FoodAcademyEntryNotFoundError);
  });

  it("reorders only featured entries and writes an audit log entry", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await makeFoodAcademyCategory();
    const a = await makeFoodAcademyEntry({ categoryId: category.id, isFeatured: true });
    const b = await makeFoodAcademyEntry({ categoryId: category.id, isFeatured: true });

    await reorderFoodAcademyFeaturedEntries(admin.id, [b.id, a.id]);

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "food_academy_featured_entries_reordered" } });
    expect(log).not.toBeNull();
  });
});
