// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { PermissionDeniedError } from "@/services/permission.errors";
import { foodAcademyPageDefaults } from "@/lib/fixtures/food-academy-fixtures";
import {
  getFoodAcademyPageSettingForAdmin,
  getFoodAcademyPageSettingForStorefront,
  updateFoodAcademyPageSettingForAdmin,
} from "@/services/food-academy-page-setting.service";
import type { FoodAcademyPageSettingAdminInput } from "@/validation/food-academy-admin.schema";

const EMAIL_DOMAIN = "@food-academy-page-setting-svc-test.test";
const ROLE_KEY_PREFIX = "food-academy-page-setting-svc-test-role-";
let sequence = 0;

/** The PUT route always calls the service with a fully-keyed object (every field parsed by the Zod schema, never a partial patch) — mirrors that real shape instead of hand-crafting a partial one. */
function fullInput(overrides: Partial<FoodAcademyPageSettingAdminInput> = {}): FoodAcademyPageSettingAdminInput {
  return {
    enabled: true,
    heroEyebrow: null,
    heroHeading: null,
    heroDescription: null,
    heroPrimaryCtaLabel: null,
    heroPrimaryCtaHref: null,
    heroSecondaryCtaLabel: null,
    heroSecondaryCtaHref: null,
    heroImageUrl: null,
    heroImageAlt: null,
    heroBadgeText: null,
    exploreHeading: null,
    exploreDescription: null,
    featuredHeading: null,
    featuredDescription: null,
    instagramEnabled: true,
    instagramHeading: null,
    instagramDescription: null,
    instagramCtaLabel: null,
    instagramCtaHref: null,
    seoTitle: null,
    seoMetaDescription: null,
    seoCanonicalPath: null,
    seoOgImageUrl: null,
    ...overrides,
  };
}

async function makeRole(grants: { module: "FoodAcademy"; action: "View" | "Edit" }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Food Academy Page Setting Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return role;
}

async function makeAdminUser(roleId: string) {
  sequence += 1;
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId } });
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  await prisma.foodAcademyPageSetting.deleteMany();
});

describe("getFoodAcademyPageSettingForStorefront", () => {
  it("falls back to fixture defaults for every unset field", async () => {
    const data = await getFoodAcademyPageSettingForStorefront();
    expect(data.heroHeading).toBe(foodAcademyPageDefaults.heroHeading);
    expect(data.heroEyebrow).toBe(foodAcademyPageDefaults.heroEyebrow);
    expect(data.enabled).toBe(true);
    // heroImageUrl now has a real fixture default too (never a blank hero
    // image before an admin uploads one) — see foodAcademyPageDefaults.
    expect(data.heroImageUrl).toBe(foodAcademyPageDefaults.heroImageUrl);
  });

  it("prefers real admin-set values over the defaults, per field", async () => {
    const role = await makeRole([
      { module: "FoodAcademy", action: "View" },
      { module: "FoodAcademy", action: "Edit" },
    ]);
    const admin = await makeAdminUser(role.id);
    await updateFoodAcademyPageSettingForAdmin(admin.id, fullInput({ heroHeading: "Custom Heading" }));

    const data = await getFoodAcademyPageSettingForStorefront();
    expect(data.heroHeading).toBe("Custom Heading");
    // Untouched fields still fall back to defaults.
    expect(data.heroEyebrow).toBe(foodAcademyPageDefaults.heroEyebrow);
  });
});

describe("admin get/update — permissions", () => {
  it("denies read without View permission", async () => {
    const role = await makeRole([]);
    const admin = await makeAdminUser(role.id);
    await expect(getFoodAcademyPageSettingForAdmin(admin.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("denies update without Edit permission", async () => {
    const role = await makeRole([{ module: "FoodAcademy", action: "View" }]);
    const admin = await makeAdminUser(role.id);
    await expect(updateFoodAcademyPageSettingForAdmin(admin.id, fullInput({ heroHeading: "X" }))).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("writes an audit log entry on update", async () => {
    const role = await makeRole([
      { module: "FoodAcademy", action: "View" },
      { module: "FoodAcademy", action: "Edit" },
    ]);
    const admin = await makeAdminUser(role.id);
    await updateFoodAcademyPageSettingForAdmin(admin.id, fullInput({ heroHeading: "Updated" }));

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "food_academy_page_settings_updated" } });
    expect(log).not.toBeNull();
  });
});
