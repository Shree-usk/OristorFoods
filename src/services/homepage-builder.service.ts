import type { ContentAlignment, HomepageLayoutStatus, HomepageSectionType, Prisma } from "@/generated/prisma/client";
import * as heroBannerRepository from "@/repositories/hero-banner.repository";
import * as homepageLayoutRepository from "@/repositories/homepage-layout.repository";
import type { HomepageLayoutDetail } from "@/repositories/homepage-layout.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import {
  DuplicateHeroBannerSectionError,
  HeroBannerSectionDuplicateNotAllowedError,
  HeroBannerSlideNotFoundError,
  HomepageLayoutNotDraftError,
  HomepageLayoutNotFoundError,
  HomepageSectionNotFoundError,
  NoArchivedLayoutError,
} from "@/services/homepage-builder.errors";
import { requirePermission } from "@/services/permission.service";

/** STORY-006's exact section order (docs/blueprint.md Section 4, minus Newsletter/Footer — already folded into the site-wide Footer, per STORY-006's own documented deviation). */
export const DEFAULT_SECTION_ORDER: HomepageSectionType[] = [
  "HeroBanner",
  "FeaturedCategories",
  "WhyChooseOristor",
  "BestSellingProducts",
  "FeaturedRecipes",
  "ProductCollections",
  "FoodAcademy",
  "CustomerReviews",
  "ExportSolutions",
  "RewardsClub",
  "InstagramGallery",
];

async function requireDraftLayout(id: string): Promise<HomepageLayoutDetail> {
  const layout = await homepageLayoutRepository.findLayoutById(id);
  if (!layout) throw new HomepageLayoutNotFoundError();
  if (layout.status !== "Draft") throw new HomepageLayoutNotDraftError();
  return layout;
}

export async function listLayouts(adminUserId: string, status?: HomepageLayoutStatus) {
  await requirePermission(adminUserId, "HomepageBuilder", "View");
  return homepageLayoutRepository.listLayouts(status);
}

export async function getLayout(adminUserId: string, id: string): Promise<HomepageLayoutDetail> {
  await requirePermission(adminUserId, "HomepageBuilder", "View");
  const layout = await homepageLayoutRepository.findLayoutById(id);
  if (!layout) throw new HomepageLayoutNotFoundError();
  return layout;
}

/**
 * Blank: seeds all 11 types in blueprint order, visible, Hero Banner with
 * zero slides (the storefront falls back gracefully — see
 * homepage.service.ts). Cloned: deep-copies the current Published
 * layout's sections + Hero Banner slides as the starting point.
 */
export async function createDraftLayout(adminUserId: string, opts: { cloneFromPublished: boolean }): Promise<HomepageLayoutDetail> {
  await requirePermission(adminUserId, "HomepageBuilder", "Edit");

  let sectionsCreate: Prisma.HomepageSectionCreateWithoutLayoutInput[];

  if (opts.cloneFromPublished) {
    const published = await homepageLayoutRepository.findPublishedLayout();
    sectionsCreate = (published?.sections ?? []).map((section) => ({
      type: section.type,
      sortOrder: section.sortOrder,
      visible: section.visible,
      titleOverride: section.titleOverride,
      descriptionOverride: section.descriptionOverride,
      banners: section.banners.length
        ? {
            create: section.banners.map((banner) => ({
              sortOrder: banner.sortOrder,
              visible: banner.visible,
              headline: banner.headline,
              subheadline: banner.subheadline,
              supportingText: banner.supportingText,
              ctaLabel: banner.ctaLabel,
              ctaHref: banner.ctaHref,
              secondaryCtaLabel: banner.secondaryCtaLabel,
              secondaryCtaHref: banner.secondaryCtaHref,
              desktopImageUrl: banner.desktopImageUrl,
              desktopImageAlt: banner.desktopImageAlt,
              mobileImageUrl: banner.mobileImageUrl,
              mobileImageAlt: banner.mobileImageAlt,
              videoUrl: banner.videoUrl,
              overlayEnabled: banner.overlayEnabled,
              alignment: banner.alignment,
            })),
          }
        : undefined,
    }));
    // A published layout might predate a since-added default section type
    // (or an admin removed one) — fill in any missing type at the end so
    // a clone always has somewhere to add it back from, matching the
    // blank-draft's full-coverage guarantee.
    for (const type of DEFAULT_SECTION_ORDER) {
      if (!sectionsCreate.some((s) => s.type === type)) {
        sectionsCreate.push({ type, sortOrder: sectionsCreate.length, visible: true });
      }
    }
  } else {
    sectionsCreate = DEFAULT_SECTION_ORDER.map((type, index) => ({ type, sortOrder: index, visible: true }));
  }

  const layout = await homepageLayoutRepository.createLayout({
    createdBy: { connect: { id: adminUserId } },
    updatedBy: { connect: { id: adminUserId } },
    sections: { create: sectionsCreate },
  });

  await writeAuditLog({ actorId: adminUserId, action: "homepage_layout_created", module: "HomepageBuilder", targetType: "HomepageLayout", targetId: layout.id });
  return layout;
}

export async function deleteDraftLayout(adminUserId: string, id: string): Promise<void> {
  await requirePermission(adminUserId, "HomepageBuilder", "Delete");
  await requireDraftLayout(id);

  await homepageLayoutRepository.deleteLayoutById(id);
  await writeAuditLog({ actorId: adminUserId, action: "homepage_layout_deleted", module: "HomepageBuilder", targetType: "HomepageLayout", targetId: id });
}

// --- Sections ---

export async function addSection(adminUserId: string, layoutId: string, type: HomepageSectionType) {
  await requirePermission(adminUserId, "HomepageBuilder", "Edit");
  await requireDraftLayout(layoutId);

  if (type === "HeroBanner") {
    const existing = await homepageLayoutRepository.countSectionsByType(layoutId, "HeroBanner");
    if (existing > 0) throw new DuplicateHeroBannerSectionError();
  }

  const sortOrder = await homepageLayoutRepository.nextSectionSortOrder(layoutId);
  const section = await homepageLayoutRepository.createSection({
    layout: { connect: { id: layoutId } },
    type,
    sortOrder,
  });

  await writeAuditLog({ actorId: adminUserId, action: "homepage_section_added", module: "HomepageBuilder", targetType: "HomepageSection", targetId: section.id });
  return section;
}

export interface UpdateSectionInput {
  visible?: boolean;
  titleOverride?: string | null;
  descriptionOverride?: string | null;
}

async function requireSectionInLayout(layoutId: string, sectionId: string) {
  const section = await homepageLayoutRepository.findSectionById(sectionId);
  if (!section || section.layoutId !== layoutId) throw new HomepageSectionNotFoundError();
  return section;
}

export async function updateSection(adminUserId: string, layoutId: string, sectionId: string, input: UpdateSectionInput) {
  await requirePermission(adminUserId, "HomepageBuilder", "Edit");
  await requireDraftLayout(layoutId);
  await requireSectionInLayout(layoutId, sectionId);

  const updated = await homepageLayoutRepository.updateSection(sectionId, input);
  await writeAuditLog({ actorId: adminUserId, action: "homepage_section_updated", module: "HomepageBuilder", targetType: "HomepageSection", targetId: sectionId });
  return updated;
}

export async function removeSection(adminUserId: string, layoutId: string, sectionId: string): Promise<void> {
  await requirePermission(adminUserId, "HomepageBuilder", "Delete");
  await requireDraftLayout(layoutId);
  await requireSectionInLayout(layoutId, sectionId);

  await homepageLayoutRepository.deleteSectionById(sectionId);
  await writeAuditLog({ actorId: adminUserId, action: "homepage_section_removed", module: "HomepageBuilder", targetType: "HomepageSection", targetId: sectionId });
}

/** Duplicates a light-touch section instance (title/description override + visibility). Hero Banner sections aren't duplicable — duplicate individual slides within it instead. */
export async function duplicateSection(adminUserId: string, layoutId: string, sectionId: string) {
  await requirePermission(adminUserId, "HomepageBuilder", "Edit");
  await requireDraftLayout(layoutId);
  const source = await requireSectionInLayout(layoutId, sectionId);
  if (source.type === "HeroBanner") throw new HeroBannerSectionDuplicateNotAllowedError();

  const sortOrder = await homepageLayoutRepository.nextSectionSortOrder(layoutId);
  const duplicate = await homepageLayoutRepository.createSection({
    layout: { connect: { id: layoutId } },
    type: source.type,
    sortOrder,
    visible: source.visible,
    titleOverride: source.titleOverride,
    descriptionOverride: source.descriptionOverride,
  });

  await writeAuditLog({ actorId: adminUserId, action: "homepage_section_duplicated", module: "HomepageBuilder", targetType: "HomepageSection", targetId: duplicate.id });
  return duplicate;
}

export async function reorderSections(adminUserId: string, layoutId: string, orderedSectionIds: string[]): Promise<void> {
  await requirePermission(adminUserId, "HomepageBuilder", "Edit");
  await requireDraftLayout(layoutId);

  await homepageLayoutRepository.reorderSections(layoutId, orderedSectionIds);
  await writeAuditLog({ actorId: adminUserId, action: "homepage_sections_reordered", module: "HomepageBuilder", targetType: "HomepageLayout", targetId: layoutId });
}

// --- Hero Banner slides ---

export interface HeroBannerSlideInput {
  headline: string;
  subheadline?: string | null;
  supportingText?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  secondaryCtaLabel?: string | null;
  secondaryCtaHref?: string | null;
  desktopImageUrl: string;
  desktopImageAlt: string;
  mobileImageUrl?: string | null;
  mobileImageAlt?: string | null;
  videoUrl?: string | null;
  overlayEnabled?: boolean;
  alignment?: ContentAlignment;
  visible?: boolean;
}

async function requireSlideInSection(sectionId: string, slideId: string) {
  const slide = await heroBannerRepository.findSlideById(slideId);
  if (!slide || slide.sectionId !== sectionId) throw new HeroBannerSlideNotFoundError();
  return slide;
}

export async function addBanner(adminUserId: string, layoutId: string, sectionId: string, input: HeroBannerSlideInput) {
  await requirePermission(adminUserId, "HomepageBuilder", "Edit");
  await requireDraftLayout(layoutId);
  await requireSectionInLayout(layoutId, sectionId);

  const sortOrder = await heroBannerRepository.nextSlideSortOrder(sectionId);
  const slide = await heroBannerRepository.createSlide({
    section: { connect: { id: sectionId } },
    sortOrder,
    ...input,
  });

  await writeAuditLog({ actorId: adminUserId, action: "homepage_banner_added", module: "HomepageBuilder", targetType: "HeroBannerSlide", targetId: slide.id });
  return slide;
}

export async function updateBanner(adminUserId: string, layoutId: string, sectionId: string, bannerId: string, input: Partial<HeroBannerSlideInput>) {
  await requirePermission(adminUserId, "HomepageBuilder", "Edit");
  await requireDraftLayout(layoutId);
  await requireSectionInLayout(layoutId, sectionId);
  await requireSlideInSection(sectionId, bannerId);

  const updated = await heroBannerRepository.updateSlide(bannerId, input);
  await writeAuditLog({ actorId: adminUserId, action: "homepage_banner_updated", module: "HomepageBuilder", targetType: "HeroBannerSlide", targetId: bannerId });
  return updated;
}

export async function removeBanner(adminUserId: string, layoutId: string, sectionId: string, bannerId: string): Promise<void> {
  await requirePermission(adminUserId, "HomepageBuilder", "Delete");
  await requireDraftLayout(layoutId);
  await requireSectionInLayout(layoutId, sectionId);
  await requireSlideInSection(sectionId, bannerId);

  await heroBannerRepository.deleteSlideById(bannerId);
  await writeAuditLog({ actorId: adminUserId, action: "homepage_banner_removed", module: "HomepageBuilder", targetType: "HeroBannerSlide", targetId: bannerId });
}

export async function duplicateBanner(adminUserId: string, layoutId: string, sectionId: string, bannerId: string) {
  await requirePermission(adminUserId, "HomepageBuilder", "Edit");
  await requireDraftLayout(layoutId);
  await requireSectionInLayout(layoutId, sectionId);
  const source = await requireSlideInSection(sectionId, bannerId);

  const sortOrder = await heroBannerRepository.nextSlideSortOrder(sectionId);
  const duplicate = await heroBannerRepository.createSlide({
    section: { connect: { id: sectionId } },
    sortOrder,
    visible: source.visible,
    headline: source.headline,
    subheadline: source.subheadline,
    supportingText: source.supportingText,
    ctaLabel: source.ctaLabel,
    ctaHref: source.ctaHref,
    secondaryCtaLabel: source.secondaryCtaLabel,
    secondaryCtaHref: source.secondaryCtaHref,
    desktopImageUrl: source.desktopImageUrl,
    desktopImageAlt: source.desktopImageAlt,
    mobileImageUrl: source.mobileImageUrl,
    mobileImageAlt: source.mobileImageAlt,
    videoUrl: source.videoUrl,
    overlayEnabled: source.overlayEnabled,
    alignment: source.alignment,
  });

  await writeAuditLog({ actorId: adminUserId, action: "homepage_banner_duplicated", module: "HomepageBuilder", targetType: "HeroBannerSlide", targetId: duplicate.id });
  return duplicate;
}

export async function reorderBanners(adminUserId: string, layoutId: string, sectionId: string, orderedBannerIds: string[]): Promise<void> {
  await requirePermission(adminUserId, "HomepageBuilder", "Edit");
  await requireDraftLayout(layoutId);
  await requireSectionInLayout(layoutId, sectionId);

  await heroBannerRepository.reorderSlides(sectionId, orderedBannerIds);
  await writeAuditLog({ actorId: adminUserId, action: "homepage_banners_reordered", module: "HomepageBuilder", targetType: "HomepageSection", targetId: sectionId });
}

// --- Publish / rollback ---

/** Atomic: publishing `id` archives whichever layout was previously live, in the same transaction — see homepage-layout.repository.ts::publishLayoutSwappingPrevious. */
export async function publishLayout(adminUserId: string, id: string): Promise<HomepageLayoutDetail> {
  await requirePermission(adminUserId, "HomepageBuilder", "Edit");
  const layout = await homepageLayoutRepository.findLayoutById(id);
  if (!layout) throw new HomepageLayoutNotFoundError();

  const published = await homepageLayoutRepository.publishLayoutSwappingPrevious(id);
  await writeAuditLog({ actorId: adminUserId, action: "homepage_layout_published", module: "HomepageBuilder", targetType: "HomepageLayout", targetId: id });
  return published;
}

/** One-level rollback: republishes the most-recently-Archived layout via the same publish primitive — reuses publishLayoutSwappingPrevious rather than a separate history mechanism (see docs/architecture-decisions.md). */
export async function rollbackToPrevious(adminUserId: string): Promise<HomepageLayoutDetail> {
  await requirePermission(adminUserId, "HomepageBuilder", "Edit");
  const target = await homepageLayoutRepository.findMostRecentlyArchivedLayout();
  if (!target) throw new NoArchivedLayoutError();

  const published = await homepageLayoutRepository.publishLayoutSwappingPrevious(target.id);
  await writeAuditLog({ actorId: adminUserId, action: "homepage_layout_rolled_back", module: "HomepageBuilder", targetType: "HomepageLayout", targetId: target.id });
  return published;
}
