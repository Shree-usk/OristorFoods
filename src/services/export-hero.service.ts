import { Prisma } from "@/generated/prisma/client";
import * as exportHeroSettingRepository from "@/repositories/export-hero-setting.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { requirePermission } from "@/services/permission.service";
import { exportHeroDefaults } from "@/lib/fixtures/home-fixtures";
import type { ExportHeroData } from "@/types/home";
import type { ExportHeroSettingInput } from "@/validation/export-hero-admin.schema";

export interface StatLineItem {
  label: string;
  description: string;
}

// --- Admin (gated HomepageBuilder — same module the real Homepage Builder nav entry/permission already use) ---

export async function getExportHeroSettingForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "HomepageBuilder", "View");
  return exportHeroSettingRepository.getExportHeroSetting();
}

export async function updateExportHeroSettingForAdmin(adminUserId: string, input: ExportHeroSettingInput) {
  await requirePermission(adminUserId, "HomepageBuilder", "Edit");
  const setting = await exportHeroSettingRepository.upsertExportHeroSetting({
    backgroundImageUrl: input.backgroundImageUrl ?? null,
    backgroundImageAlt: input.backgroundImageAlt ?? null,
    eyebrow: input.eyebrow ?? null,
    headline: input.headline ?? null,
    description: input.description ?? null,
    primaryCtaLabel: input.primaryCtaLabel ?? null,
    primaryCtaHref: input.primaryCtaHref ?? null,
    secondaryCtaLabel: input.secondaryCtaLabel ?? null,
    secondaryCtaHref: input.secondaryCtaHref ?? null,
    // Prisma.DbNull (not JS null) clears a nullable Json column back to SQL NULL — same gotcha system-settings.service.ts::updateCompanySetting's own socialLinks field documents.
    statLine: input.statLine === null || input.statLine?.length === 0 ? Prisma.DbNull : input.statLine,
    badgeEyebrow: input.badgeEyebrow ?? null,
    badgeHeadline: input.badgeHeadline ?? null,
    badgeDescription: input.badgeDescription ?? null,
    badgeCtaLabel: input.badgeCtaLabel ?? null,
    badgeCtaHref: input.badgeCtaHref ?? null,
  });
  await writeAuditLog({ actorId: adminUserId, action: "export_hero_settings_updated", module: "HomepageBuilder", targetType: "ExportHeroSetting", targetId: "global" });
  return setting;
}

// --- Storefront (public, no permission gate) ---

/**
 * Real data wins, the fixture default is only the safety net for whichever
 * individual fields an admin hasn't set yet — same "never blank" shape
 * every other homepage section already follows (see
 * homepage-sections.tsx's own FeaturedCategories/ProductCollections cutover
 * comments), just applied per-field here instead of per-section since this
 * is one rich section, not an N-item list that's either populated or not.
 */
export async function getExportHeroForStorefront(): Promise<ExportHeroData> {
  const setting = await exportHeroSettingRepository.getExportHeroSetting();
  const statLine = (setting?.statLine as StatLineItem[] | null) ?? null;

  return {
    backgroundImageUrl: setting?.backgroundImageUrl ?? exportHeroDefaults.backgroundImageUrl,
    backgroundImageAlt: setting?.backgroundImageAlt ?? exportHeroDefaults.backgroundImageAlt,
    eyebrow: setting?.eyebrow ?? exportHeroDefaults.eyebrow,
    headline: setting?.headline ?? exportHeroDefaults.headline,
    description: setting?.description ?? exportHeroDefaults.description,
    primaryCtaLabel: setting?.primaryCtaLabel ?? exportHeroDefaults.primaryCtaLabel,
    primaryCtaHref: setting?.primaryCtaHref ?? exportHeroDefaults.primaryCtaHref,
    secondaryCtaLabel: setting?.secondaryCtaLabel ?? exportHeroDefaults.secondaryCtaLabel,
    secondaryCtaHref: setting?.secondaryCtaHref ?? exportHeroDefaults.secondaryCtaHref,
    statLine: statLine && statLine.length > 0 ? statLine : exportHeroDefaults.statLine,
    badge:
      setting?.badgeHeadline || exportHeroDefaults.badge
        ? {
            eyebrow: setting?.badgeEyebrow ?? exportHeroDefaults.badge?.eyebrow ?? "",
            headline: setting?.badgeHeadline ?? exportHeroDefaults.badge?.headline ?? "",
            description: setting?.badgeDescription ?? exportHeroDefaults.badge?.description ?? "",
            ctaLabel: setting?.badgeCtaLabel ?? exportHeroDefaults.badge?.ctaLabel ?? "",
            ctaHref: setting?.badgeCtaHref ?? exportHeroDefaults.badge?.ctaHref ?? "",
          }
        : null,
  };
}
