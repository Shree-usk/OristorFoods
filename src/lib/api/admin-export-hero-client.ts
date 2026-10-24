/** Fetch wrappers for /api/admin/homepage-builder/export-hero. */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export interface ExportHeroStatLineItem {
  label: string;
  description: string;
}

export interface ExportHeroSetting {
  id: string;
  backgroundImageUrl: string | null;
  backgroundImageAlt: string | null;
  eyebrow: string | null;
  headline: string | null;
  description: string | null;
  primaryCtaLabel: string | null;
  primaryCtaHref: string | null;
  secondaryCtaLabel: string | null;
  secondaryCtaHref: string | null;
  statLine: ExportHeroStatLineItem[] | null;
  badgeEyebrow: string | null;
  badgeHeadline: string | null;
  badgeDescription: string | null;
  badgeCtaLabel: string | null;
  badgeCtaHref: string | null;
  updatedAt: string;
}

export interface ExportHeroSettingInput {
  backgroundImageUrl?: string | null;
  backgroundImageAlt?: string | null;
  eyebrow?: string | null;
  headline?: string | null;
  description?: string | null;
  primaryCtaLabel?: string | null;
  primaryCtaHref?: string | null;
  secondaryCtaLabel?: string | null;
  secondaryCtaHref?: string | null;
  statLine?: ExportHeroStatLineItem[] | null;
  badgeEyebrow?: string | null;
  badgeHeadline?: string | null;
  badgeDescription?: string | null;
  badgeCtaLabel?: string | null;
  badgeCtaHref?: string | null;
}

export async function fetchExportHeroSetting(): Promise<ExportHeroSetting | null> {
  const response = await fetch("/api/admin/homepage-builder/export-hero");
  if (!response.ok) throw new Error(`Failed to load the Export Hero settings (${response.status})`);
  return response.json();
}

export async function updateExportHeroSetting(input: ExportHeroSettingInput): Promise<ExportHeroSetting> {
  const response = await fetch("/api/admin/homepage-builder/export-hero", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await assertOkWithServerMessage(response, "Failed to save the Export Hero settings");
  return response.json();
}
