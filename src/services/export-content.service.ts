import * as exportContentRepository from "@/repositories/export-content.repository";
import { listCertifications } from "@/repositories/product.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import {
  ExportCertificationStripItemNotFoundError,
  ExportProcessStepNotFoundError,
  ExportSolutionCardNotFoundError,
} from "@/services/export-content.errors";
import { requirePermission } from "@/services/permission.service";

export interface ExportPageHeroSettingInput {
  backgroundImageUrl?: string | null;
  backgroundImageAlt?: string | null;
  eyebrow?: string | null;
  headline?: string | null;
  description?: string | null;
  primaryCtaLabel?: string | null;
  primaryCtaHref?: string | null;
  secondaryCtaLabel?: string | null;
  secondaryCtaHref?: string | null;
}

/**
 * The page's original, already-approved copy — used as the per-field
 * fallback until an admin overrides it, same "never blank" merge
 * `getExportHeroForStorefront` (the homepage's separate teaser) already
 * follows. Keeping this as code, not a seed row, means a fresh
 * environment's /export page matches what shipped even before an admin
 * touches this setting.
 */
const EXPORT_PAGE_HERO_DEFAULTS = {
  eyebrow: "Export Solutions",
  headline: "Partner with Oristor for Global Distribution",
  description:
    "From single-origin sourcing to bulk export packaging, we work with distributors, importers, and retailers worldwide to bring authentic Sri Lankan food products to new markets. Browse our collections, select the products you're interested in, and our export team will follow up with pricing and availability.",
  primaryCtaLabel: "Explore Export Catalogue",
  primaryCtaHref: "/export#catalogue",
  secondaryCtaLabel: "Download Brochure",
  secondaryCtaHref: null as string | null,
  backgroundImageUrl: null as string | null,
  backgroundImageAlt: null as string | null,
};

// --- /export page hero (admin, gated ExportPortal) ---

export async function getPageHeroSettingForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "ExportPortal", "View");
  return exportContentRepository.getPageHeroSetting();
}

export async function updatePageHeroSetting(adminUserId: string, input: ExportPageHeroSettingInput) {
  await requirePermission(adminUserId, "ExportPortal", "Edit");
  const updated = await exportContentRepository.upsertPageHeroSetting(input);
  await writeAuditLog({ actorId: adminUserId, action: "export_page_hero_updated", module: "ExportPortal", targetType: "ExportPageHeroSetting", targetId: "global" });
  return updated;
}

export interface ExportSolutionCardInput {
  icon: string;
  iconImageUrl?: string | null;
  title: string;
  description: string;
  visible?: boolean;
}

export interface ExportProcessStepInput {
  icon: string;
  iconImageUrl?: string | null;
  title: string;
  description: string;
  visible?: boolean;
}

export interface ExportCertificationStripItemInput {
  imageUrl?: string | null;
  label: string;
  visible?: boolean;
}

// --- Export Solutions cards (admin, gated ExportPortal) ---

export async function listSolutionCardsForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "ExportPortal", "View");
  return exportContentRepository.listSolutionCards();
}

export async function addSolutionCard(adminUserId: string, input: ExportSolutionCardInput) {
  await requirePermission(adminUserId, "ExportPortal", "Edit");
  const sortOrder = await exportContentRepository.nextSolutionCardSortOrder();
  const card = await exportContentRepository.createSolutionCard({ sortOrder, ...input });
  await writeAuditLog({ actorId: adminUserId, action: "export_solution_card_added", module: "ExportPortal", targetType: "ExportSolutionCard", targetId: card.id });
  return card;
}

export async function updateSolutionCard(adminUserId: string, id: string, input: Partial<ExportSolutionCardInput>) {
  await requirePermission(adminUserId, "ExportPortal", "Edit");
  const existing = await exportContentRepository.findSolutionCardById(id);
  if (!existing) throw new ExportSolutionCardNotFoundError();
  const updated = await exportContentRepository.updateSolutionCard(id, input);
  await writeAuditLog({ actorId: adminUserId, action: "export_solution_card_updated", module: "ExportPortal", targetType: "ExportSolutionCard", targetId: id });
  return updated;
}

export async function removeSolutionCard(adminUserId: string, id: string): Promise<void> {
  await requirePermission(adminUserId, "ExportPortal", "Delete");
  const existing = await exportContentRepository.findSolutionCardById(id);
  if (!existing) throw new ExportSolutionCardNotFoundError();
  await exportContentRepository.deleteSolutionCardById(id);
  await writeAuditLog({ actorId: adminUserId, action: "export_solution_card_removed", module: "ExportPortal", targetType: "ExportSolutionCard", targetId: id });
}

export async function reorderSolutionCards(adminUserId: string, orderedIds: string[]): Promise<void> {
  await requirePermission(adminUserId, "ExportPortal", "Edit");
  await exportContentRepository.reorderSolutionCards(orderedIds);
  await writeAuditLog({ actorId: adminUserId, action: "export_solution_cards_reordered", module: "ExportPortal", targetType: "ExportSolutionCard", targetId: "all" });
}

// --- Export Process steps (admin, gated ExportPortal) ---

export async function listProcessStepsForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "ExportPortal", "View");
  return exportContentRepository.listProcessSteps();
}

export async function addProcessStep(adminUserId: string, input: ExportProcessStepInput) {
  await requirePermission(adminUserId, "ExportPortal", "Edit");
  const sortOrder = await exportContentRepository.nextProcessStepSortOrder();
  const step = await exportContentRepository.createProcessStep({ sortOrder, ...input });
  await writeAuditLog({ actorId: adminUserId, action: "export_process_step_added", module: "ExportPortal", targetType: "ExportProcessStep", targetId: step.id });
  return step;
}

export async function updateProcessStep(adminUserId: string, id: string, input: Partial<ExportProcessStepInput>) {
  await requirePermission(adminUserId, "ExportPortal", "Edit");
  const existing = await exportContentRepository.findProcessStepById(id);
  if (!existing) throw new ExportProcessStepNotFoundError();
  const updated = await exportContentRepository.updateProcessStep(id, input);
  await writeAuditLog({ actorId: adminUserId, action: "export_process_step_updated", module: "ExportPortal", targetType: "ExportProcessStep", targetId: id });
  return updated;
}

export async function removeProcessStep(adminUserId: string, id: string): Promise<void> {
  await requirePermission(adminUserId, "ExportPortal", "Delete");
  const existing = await exportContentRepository.findProcessStepById(id);
  if (!existing) throw new ExportProcessStepNotFoundError();
  await exportContentRepository.deleteProcessStepById(id);
  await writeAuditLog({ actorId: adminUserId, action: "export_process_step_removed", module: "ExportPortal", targetType: "ExportProcessStep", targetId: id });
}

export async function reorderProcessSteps(adminUserId: string, orderedIds: string[]): Promise<void> {
  await requirePermission(adminUserId, "ExportPortal", "Edit");
  await exportContentRepository.reorderProcessSteps(orderedIds);
  await writeAuditLog({ actorId: adminUserId, action: "export_process_steps_reordered", module: "ExportPortal", targetType: "ExportProcessStep", targetId: "all" });
}

// --- Certification strip items (admin, gated ExportPortal) ---
// Deliberately separate from Certification/getCertificationsForStorefront
// below — this strip holds any short trust claim the business wants
// shown under the hero, not only formal product certifications, and the
// business wants to keep adding to it freely. See the schema comment on
// ExportCertificationStripItem.

export async function listCertificationStripItemsForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "ExportPortal", "View");
  return exportContentRepository.listCertificationStripItems();
}

export async function addCertificationStripItem(adminUserId: string, input: ExportCertificationStripItemInput) {
  await requirePermission(adminUserId, "ExportPortal", "Edit");
  const sortOrder = await exportContentRepository.nextCertificationStripItemSortOrder();
  const item = await exportContentRepository.createCertificationStripItem({ sortOrder, ...input });
  await writeAuditLog({ actorId: adminUserId, action: "export_certification_strip_item_added", module: "ExportPortal", targetType: "ExportCertificationStripItem", targetId: item.id });
  return item;
}

export async function updateCertificationStripItem(adminUserId: string, id: string, input: Partial<ExportCertificationStripItemInput>) {
  await requirePermission(adminUserId, "ExportPortal", "Edit");
  const existing = await exportContentRepository.findCertificationStripItemById(id);
  if (!existing) throw new ExportCertificationStripItemNotFoundError();
  const updated = await exportContentRepository.updateCertificationStripItem(id, input);
  await writeAuditLog({ actorId: adminUserId, action: "export_certification_strip_item_updated", module: "ExportPortal", targetType: "ExportCertificationStripItem", targetId: id });
  return updated;
}

export async function removeCertificationStripItem(adminUserId: string, id: string): Promise<void> {
  await requirePermission(adminUserId, "ExportPortal", "Delete");
  const existing = await exportContentRepository.findCertificationStripItemById(id);
  if (!existing) throw new ExportCertificationStripItemNotFoundError();
  await exportContentRepository.deleteCertificationStripItemById(id);
  await writeAuditLog({ actorId: adminUserId, action: "export_certification_strip_item_removed", module: "ExportPortal", targetType: "ExportCertificationStripItem", targetId: id });
}

export async function reorderCertificationStripItems(adminUserId: string, orderedIds: string[]): Promise<void> {
  await requirePermission(adminUserId, "ExportPortal", "Edit");
  await exportContentRepository.reorderCertificationStripItems(orderedIds);
  await writeAuditLog({ actorId: adminUserId, action: "export_certification_strip_items_reordered", module: "ExportPortal", targetType: "ExportCertificationStripItem", targetId: "all" });
}

// --- Storefront (public, no permission gate) ---

export async function getPageHeroForStorefront() {
  const setting = await exportContentRepository.getPageHeroSetting();
  return {
    backgroundImageUrl: setting?.backgroundImageUrl ?? EXPORT_PAGE_HERO_DEFAULTS.backgroundImageUrl,
    backgroundImageAlt: setting?.backgroundImageAlt ?? EXPORT_PAGE_HERO_DEFAULTS.backgroundImageAlt,
    eyebrow: setting?.eyebrow ?? EXPORT_PAGE_HERO_DEFAULTS.eyebrow,
    headline: setting?.headline ?? EXPORT_PAGE_HERO_DEFAULTS.headline,
    description: setting?.description ?? EXPORT_PAGE_HERO_DEFAULTS.description,
    primaryCtaLabel: setting?.primaryCtaLabel ?? EXPORT_PAGE_HERO_DEFAULTS.primaryCtaLabel,
    primaryCtaHref: setting?.primaryCtaHref ?? EXPORT_PAGE_HERO_DEFAULTS.primaryCtaHref,
    secondaryCtaLabel: setting?.secondaryCtaLabel ?? EXPORT_PAGE_HERO_DEFAULTS.secondaryCtaLabel,
    secondaryCtaHref: setting?.secondaryCtaHref ?? EXPORT_PAGE_HERO_DEFAULTS.secondaryCtaHref,
  };
}

export async function getSolutionCardsForStorefront() {
  const cards = await exportContentRepository.listSolutionCards();
  return cards.filter((card) => card.visible);
}

export async function getProcessStepsForStorefront() {
  const steps = await exportContentRepository.listProcessSteps();
  return steps.filter((step) => step.visible);
}

export async function getCertificationStripForStorefront() {
  const items = await exportContentRepository.listCertificationStripItems();
  return items.filter((item) => item.visible);
}

/**
 * Real, admin-managed Certification rows (name + a real certificateImage
 * logo) — the same model already used on individual products. Only used
 * for the footer's certification badges; the /export page's own
 * certification strip uses getCertificationStripForStorefront above
 * instead. A certification only earns a spot in the footer once it has
 * both a name and a logo image; nothing here invents a certification the
 * business doesn't actually hold.
 */
export async function getCertificationsForStorefront() {
  const certifications = await listCertifications();
  return certifications.filter((certification) => certification.certificateImage);
}
