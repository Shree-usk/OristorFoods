/** STORY-050e. Admin fetch wrappers for /api/admin/marketing/landing-pages — mirrors popup-admin-client.ts's exact shape (STORY-050a). */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type LandingPageStatusValue = "Draft" | "Published" | "Archived";
export type ContentAlignmentValue = "Left" | "Center" | "Right";

export interface LandingPage {
  id: string;
  name: string;
  slug: string;
  status: LandingPageStatusValue;
  metaTitle: string | null;
  metaDescription: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface LandingPageBlock {
  id: string;
  landingPageId: string;
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
  alignment: ContentAlignmentValue;
}

export interface LandingPageDetail extends LandingPage {
  blocks: LandingPageBlock[];
}

export interface LandingPageFormInput {
  name: string;
  slug: string;
  metaTitle: string | null;
  metaDescription: string | null;
}

export interface LandingPageBlockFormInput {
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
  alignment: ContentAlignmentValue;
}

export async function fetchLandingPages(): Promise<{ landingPages: LandingPage[] }> {
  const response = await fetch("/api/admin/marketing/landing-pages");
  if (!response.ok) throw new Error("Failed to load landing pages");
  return response.json();
}

export async function fetchLandingPage(id: string): Promise<LandingPageDetail> {
  const response = await fetch(`/api/admin/marketing/landing-pages/${id}`);
  if (!response.ok) throw new Error("Failed to load the landing page");
  return response.json();
}

export async function createLandingPageAdmin(input: LandingPageFormInput): Promise<LandingPage> {
  const response = await fetch("/api/admin/marketing/landing-pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to create the landing page");
  return response.json();
}

export async function updateLandingPageAdmin(id: string, input: Partial<LandingPageFormInput>): Promise<LandingPage> {
  const response = await fetch(`/api/admin/marketing/landing-pages/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to update the landing page");
  return response.json();
}

export async function changeLandingPageStatusAdmin(id: string, status: LandingPageStatusValue): Promise<LandingPage> {
  const response = await fetch(`/api/admin/marketing/landing-pages/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
  await assertOkWithServerMessage(response, "Failed to update the landing page's status");
  return response.json();
}

export async function createLandingPageBlockAdmin(landingPageId: string, input: LandingPageBlockFormInput): Promise<LandingPageBlock> {
  const response = await fetch(`/api/admin/marketing/landing-pages/${landingPageId}/blocks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to add the block");
  return response.json();
}

export async function updateLandingPageBlockAdmin(blockId: string, input: Partial<LandingPageBlockFormInput & { visible: boolean }>): Promise<LandingPageBlock> {
  const response = await fetch(`/api/admin/marketing/landing-pages/blocks/${blockId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to update the block");
  return response.json();
}

export async function deleteLandingPageBlockAdmin(blockId: string): Promise<void> {
  const response = await fetch(`/api/admin/marketing/landing-pages/blocks/${blockId}`, { method: "DELETE" });
  await assertOkWithServerMessage(response, "Failed to delete the block");
}

export async function reorderLandingPageBlocksAdmin(landingPageId: string, blockIds: string[]): Promise<void> {
  const response = await fetch(`/api/admin/marketing/landing-pages/${landingPageId}/blocks/reorder`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blockIds }) });
  await assertOkWithServerMessage(response, "Failed to reorder blocks");
}
