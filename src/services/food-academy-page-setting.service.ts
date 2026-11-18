import * as foodAcademyPageSettingRepository from "@/repositories/food-academy-page-setting.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { requirePermission } from "@/services/permission.service";
import { foodAcademyPageDefaults } from "@/lib/fixtures/food-academy-fixtures";
import type { FoodAcademyPageSettingAdminInput } from "@/validation/food-academy-admin.schema";
import type { FoodAcademyPageSettingData } from "@/types/food-academy";

// --- Admin (gated FoodAcademy) ---

export async function getFoodAcademyPageSettingForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "FoodAcademy", "View");
  return foodAcademyPageSettingRepository.getFoodAcademyPageSetting();
}

export async function updateFoodAcademyPageSettingForAdmin(adminUserId: string, input: FoodAcademyPageSettingAdminInput) {
  await requirePermission(adminUserId, "FoodAcademy", "Edit");
  const setting = await foodAcademyPageSettingRepository.upsertFoodAcademyPageSetting({
    enabled: input.enabled ?? true,
    heroEyebrow: input.heroEyebrow ?? null,
    heroHeading: input.heroHeading ?? null,
    heroDescription: input.heroDescription ?? null,
    heroPrimaryCtaLabel: input.heroPrimaryCtaLabel ?? null,
    heroPrimaryCtaHref: input.heroPrimaryCtaHref ?? null,
    heroSecondaryCtaLabel: input.heroSecondaryCtaLabel ?? null,
    heroSecondaryCtaHref: input.heroSecondaryCtaHref ?? null,
    heroImageUrl: input.heroImageUrl ?? null,
    heroImageAlt: input.heroImageAlt ?? null,
    heroBadgeText: input.heroBadgeText ?? null,
    exploreHeading: input.exploreHeading ?? null,
    exploreDescription: input.exploreDescription ?? null,
    featuredHeading: input.featuredHeading ?? null,
    featuredDescription: input.featuredDescription ?? null,
    instagramEnabled: input.instagramEnabled ?? true,
    instagramHeading: input.instagramHeading ?? null,
    instagramDescription: input.instagramDescription ?? null,
    instagramCtaLabel: input.instagramCtaLabel ?? null,
    instagramCtaHref: input.instagramCtaHref ?? null,
    seoTitle: input.seoTitle ?? null,
    seoMetaDescription: input.seoMetaDescription ?? null,
    seoCanonicalPath: input.seoCanonicalPath ?? null,
    seoOgImageUrl: input.seoOgImageUrl ?? null,
  });
  await writeAuditLog({ actorId: adminUserId, action: "food_academy_page_settings_updated", module: "FoodAcademy", targetType: "FoodAcademyPageSetting", targetId: "global" });
  return setting;
}

// --- Storefront (public, no permission gate) ---

/**
 * Real data wins, the fixture default is only the safety net for whichever
 * individual fields an admin hasn't set yet — same per-field "never blank"
 * idiom as export-hero.service.ts::getExportHeroForStorefront.
 */
export async function getFoodAcademyPageSettingForStorefront(): Promise<FoodAcademyPageSettingData> {
  const setting = await foodAcademyPageSettingRepository.getFoodAcademyPageSetting();
  const d = foodAcademyPageDefaults;

  return {
    enabled: setting?.enabled ?? true,
    heroEyebrow: setting?.heroEyebrow ?? d.heroEyebrow,
    heroHeading: setting?.heroHeading ?? d.heroHeading,
    heroDescription: setting?.heroDescription ?? d.heroDescription,
    heroPrimaryCtaLabel: setting?.heroPrimaryCtaLabel ?? d.heroPrimaryCtaLabel,
    heroPrimaryCtaHref: setting?.heroPrimaryCtaHref ?? d.heroPrimaryCtaHref,
    heroSecondaryCtaLabel: setting?.heroSecondaryCtaLabel ?? d.heroSecondaryCtaLabel,
    heroSecondaryCtaHref: setting?.heroSecondaryCtaHref ?? d.heroSecondaryCtaHref,
    heroImageUrl: setting?.heroImageUrl ?? null,
    heroImageAlt: setting?.heroImageAlt ?? d.heroImageAlt,
    heroBadgeText: setting?.heroBadgeText ?? d.heroBadgeText,
    exploreHeading: setting?.exploreHeading ?? d.exploreHeading,
    exploreDescription: setting?.exploreDescription ?? d.exploreDescription,
    featuredHeading: setting?.featuredHeading ?? d.featuredHeading,
    featuredDescription: setting?.featuredDescription ?? d.featuredDescription,
    instagramEnabled: setting?.instagramEnabled ?? d.instagramEnabled,
    instagramHeading: setting?.instagramHeading ?? d.instagramHeading,
    instagramDescription: setting?.instagramDescription ?? d.instagramDescription,
    instagramCtaLabel: setting?.instagramCtaLabel ?? d.instagramCtaLabel,
    instagramCtaHref: setting?.instagramCtaHref ?? d.instagramCtaHref,
    seoTitle: setting?.seoTitle ?? d.seoTitle,
    seoMetaDescription: setting?.seoMetaDescription ?? d.seoMetaDescription,
    seoCanonicalPath: setting?.seoCanonicalPath ?? d.seoCanonicalPath,
    seoOgImageUrl: setting?.seoOgImageUrl ?? null,
  };
}
