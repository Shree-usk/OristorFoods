/** STORY-042. Fetch wrappers for /api/admin/homepage-builder/* — mirrors admin-media-client.ts's assertOk convention. */

function assertOk(response: Response, message: string): void {
  if (!response.ok) throw new Error(`${message} (${response.status})`);
}

export type HomepageLayoutStatus = "Draft" | "Published" | "Archived";
export type ContentAlignment = "Left" | "Center" | "Right";
export type HomepageSectionType =
  | "HeroBanner"
  | "FeaturedCategories"
  | "WhyChooseOristor"
  | "BestSellingProducts"
  | "FeaturedRecipes"
  | "ProductCollections"
  | "FoodAcademy"
  | "CustomerReviews"
  | "ExportSolutions"
  | "RewardsClub"
  | "InstagramGallery";

export interface HeroBannerSlide {
  id: string;
  sectionId: string;
  sortOrder: number;
  visible: boolean;
  headline: string;
  subheadline: string | null;
  supportingText: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  secondaryCtaLabel: string | null;
  secondaryCtaHref: string | null;
  desktopImageUrl: string;
  desktopImageAlt: string;
  mobileImageUrl: string | null;
  mobileImageAlt: string | null;
  videoUrl: string | null;
  overlayEnabled: boolean;
  alignment: ContentAlignment;
}

export interface HomepageSection {
  id: string;
  layoutId: string;
  type: HomepageSectionType;
  sortOrder: number;
  visible: boolean;
  titleOverride: string | null;
  descriptionOverride: string | null;
  banners: HeroBannerSlide[];
}

export interface HomepageLayout {
  id: string;
  status: HomepageLayoutStatus;
  publishedAt: string | null;
  sections: HomepageSection[];
  createdAt: string;
  updatedAt: string;
}

export interface HomepageLayoutSummary {
  id: string;
  status: HomepageLayoutStatus;
  publishedAt: string | null;
  updatedAt: string;
  sections: { id: string }[];
}

export async function fetchHomepageLayouts(status?: HomepageLayoutStatus): Promise<HomepageLayoutSummary[]> {
  const query = status ? `?status=${status}` : "";
  const response = await fetch(`/api/admin/homepage-builder/layouts${query}`);
  assertOk(response, "Failed to load layouts");
  const body: { layouts: HomepageLayoutSummary[] } = await response.json();
  return body.layouts;
}

export async function fetchHomepageLayout(id: string): Promise<HomepageLayout> {
  const response = await fetch(`/api/admin/homepage-builder/layouts/${id}`);
  assertOk(response, "Failed to load layout");
  return response.json();
}

export async function createDraftLayout(cloneFromPublished: boolean): Promise<HomepageLayout> {
  const response = await fetch("/api/admin/homepage-builder/layouts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cloneFromPublished }),
  });
  assertOk(response, "Failed to create draft layout");
  return response.json();
}

export async function deleteDraftLayout(id: string): Promise<void> {
  const response = await fetch(`/api/admin/homepage-builder/layouts/${id}`, { method: "DELETE" });
  assertOk(response, "Failed to delete draft layout");
}

export async function publishLayout(id: string): Promise<HomepageLayout> {
  const response = await fetch(`/api/admin/homepage-builder/layouts/${id}/publish`, { method: "POST" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Failed to publish layout" }));
    throw new Error(body.error ?? "Failed to publish layout");
  }
  return response.json();
}

export async function rollbackToPrevious(): Promise<HomepageLayout> {
  const response = await fetch("/api/admin/homepage-builder/rollback", { method: "POST" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Failed to roll back" }));
    throw new Error(body.error ?? "Failed to roll back");
  }
  return response.json();
}

export async function addSection(layoutId: string, type: HomepageSectionType): Promise<HomepageSection> {
  const response = await fetch(`/api/admin/homepage-builder/layouts/${layoutId}/sections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Failed to add section" }));
    throw new Error(body.error ?? "Failed to add section");
  }
  return response.json();
}

export async function updateSection(
  layoutId: string,
  sectionId: string,
  input: { visible?: boolean; titleOverride?: string | null; descriptionOverride?: string | null },
): Promise<HomepageSection> {
  const response = await fetch(`/api/admin/homepage-builder/layouts/${layoutId}/sections/${sectionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  assertOk(response, "Failed to update section");
  return response.json();
}

export async function removeSection(layoutId: string, sectionId: string): Promise<void> {
  const response = await fetch(`/api/admin/homepage-builder/layouts/${layoutId}/sections/${sectionId}`, { method: "DELETE" });
  assertOk(response, "Failed to remove section");
}

export async function duplicateSection(layoutId: string, sectionId: string): Promise<HomepageSection> {
  const response = await fetch(`/api/admin/homepage-builder/layouts/${layoutId}/sections/${sectionId}/duplicate`, { method: "POST" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Failed to duplicate section" }));
    throw new Error(body.error ?? "Failed to duplicate section");
  }
  return response.json();
}

export async function reorderSections(layoutId: string, orderedIds: string[]): Promise<void> {
  const response = await fetch(`/api/admin/homepage-builder/layouts/${layoutId}/sections/reorder`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderedIds }),
  });
  assertOk(response, "Failed to reorder sections");
}

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

export async function addBanner(layoutId: string, sectionId: string, input: HeroBannerSlideInput): Promise<HeroBannerSlide> {
  const response = await fetch(`/api/admin/homepage-builder/layouts/${layoutId}/sections/${sectionId}/banners`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Failed to add banner" }));
    throw new Error(body.error ?? "Failed to add banner");
  }
  return response.json();
}

export async function updateBanner(layoutId: string, sectionId: string, bannerId: string, input: Partial<HeroBannerSlideInput>): Promise<HeroBannerSlide> {
  const response = await fetch(`/api/admin/homepage-builder/layouts/${layoutId}/sections/${sectionId}/banners/${bannerId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Failed to update banner" }));
    throw new Error(body.error ?? "Failed to update banner");
  }
  return response.json();
}

export async function removeBanner(layoutId: string, sectionId: string, bannerId: string): Promise<void> {
  const response = await fetch(`/api/admin/homepage-builder/layouts/${layoutId}/sections/${sectionId}/banners/${bannerId}`, { method: "DELETE" });
  assertOk(response, "Failed to remove banner");
}

export async function duplicateBanner(layoutId: string, sectionId: string, bannerId: string): Promise<HeroBannerSlide> {
  const response = await fetch(`/api/admin/homepage-builder/layouts/${layoutId}/sections/${sectionId}/banners/${bannerId}/duplicate`, { method: "POST" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Failed to duplicate banner" }));
    throw new Error(body.error ?? "Failed to duplicate banner");
  }
  return response.json();
}

export async function reorderBanners(layoutId: string, sectionId: string, orderedIds: string[]): Promise<void> {
  const response = await fetch(`/api/admin/homepage-builder/layouts/${layoutId}/sections/${sectionId}/banners/reorder`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderedIds }),
  });
  assertOk(response, "Failed to reorder banners");
}
