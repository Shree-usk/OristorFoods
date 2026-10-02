import type { LandingPageStatus } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import * as landingPageRepository from "@/repositories/landing-page.repository";
import type { LandingPageBlockInput, LandingPageContentInput } from "@/repositories/landing-page.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { IllegalLandingPageStatusTransitionError, LandingPageBlockNotFoundError, LandingPageNotFoundError, LandingPageSlugTakenError } from "@/services/landing-page.errors";
import { requirePermission } from "@/services/permission.service";

/**
 * STORY-050e. Permission gating mirrors popup.service.ts (STORY-050a)
 * exactly: View for reads, Edit for content/block CRUD and the
 * low-risk status direction (taking a page down), Approve specifically
 * for whatever makes a page publicly reachable (Published).
 */

function isUniqueConstraintViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Mirrors product-admin.service.ts::conflictField — the @prisma/adapter-pg driver reports a P2002's violated column(s) under meta.driverAdapterError.cause.constraint.fields, not the classic meta.target shape. */
function conflictField(error: Prisma.PrismaClientKnownRequestError): string | undefined {
  const meta = error.meta as { target?: unknown; driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } } } | undefined;
  const adapterFields = meta?.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(adapterFields) && typeof adapterFields[0] === "string") return adapterFields[0];
  const target = meta?.target;
  if (Array.isArray(target)) return target[0] as string;
  if (typeof target === "string") return target;
  return undefined;
}

// --- Admin CRUD ---

export async function listLandingPagesForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "Marketing", "View");
  return landingPageRepository.listLandingPagesForAdmin();
}

async function requireLandingPageRow(id: string) {
  const landingPage = await landingPageRepository.findLandingPageById(id);
  if (!landingPage) throw new LandingPageNotFoundError();
  return landingPage;
}

export async function getLandingPageAdminDetail(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "Marketing", "View");
  return requireLandingPageRow(id);
}

export async function createLandingPage(adminUserId: string, input: LandingPageContentInput) {
  await requirePermission(adminUserId, "Marketing", "Edit");
  try {
    const landingPage = await landingPageRepository.createLandingPage(input, adminUserId);
    await writeAuditLog({ actorId: adminUserId, action: "landing_page_created", module: "Marketing", targetType: "LandingPage", targetId: landingPage.id, metadata: { slug: landingPage.slug } });
    return landingPage;
  } catch (error) {
    if (isUniqueConstraintViolation(error) && conflictField(error) === "slug") throw new LandingPageSlugTakenError();
    throw error;
  }
}

export async function updateLandingPage(adminUserId: string, id: string, input: Partial<LandingPageContentInput>) {
  await requirePermission(adminUserId, "Marketing", "Edit");
  await requireLandingPageRow(id);
  try {
    const landingPage = await landingPageRepository.updateLandingPage(id, input);
    await writeAuditLog({ actorId: adminUserId, action: "landing_page_updated", module: "Marketing", targetType: "LandingPage", targetId: id });
    return landingPage;
  } catch (error) {
    if (isUniqueConstraintViolation(error) && conflictField(error) === "slug") throw new LandingPageSlugTakenError();
    throw error;
  }
}

// --- Status workflow ---

const EDIT_TRANSITIONS: Partial<Record<LandingPageStatus, LandingPageStatus[]>> = {
  Draft: ["Archived"],
  Archived: ["Draft"],
  Published: ["Archived"],
};

const APPROVE_TRANSITIONS: Partial<Record<LandingPageStatus, LandingPageStatus[]>> = {
  Draft: ["Published"],
  Archived: ["Published"],
};

export async function changeLandingPageStatus(adminUserId: string, id: string, to: LandingPageStatus) {
  const landingPage = await requireLandingPageRow(id);
  const from = landingPage.status;

  if (EDIT_TRANSITIONS[from]?.includes(to)) {
    await requirePermission(adminUserId, "Marketing", "Edit");
  } else if (APPROVE_TRANSITIONS[from]?.includes(to)) {
    await requirePermission(adminUserId, "Marketing", "Approve");
  } else {
    throw new IllegalLandingPageStatusTransitionError(from, to);
  }

  const updated = await landingPageRepository.updateLandingPageStatus(id, to, to === "Published" ? new Date() : landingPage.publishedAt);
  await writeAuditLog({ actorId: adminUserId, action: "landing_page_status_changed", module: "Marketing", targetType: "LandingPage", targetId: id, metadata: { from, to } });
  return updated;
}

// --- Block CRUD ---

export async function createBlock(adminUserId: string, landingPageId: string, input: LandingPageBlockInput) {
  await requirePermission(adminUserId, "Marketing", "Edit");
  await requireLandingPageRow(landingPageId);
  const block = await landingPageRepository.createBlock(landingPageId, input);
  await writeAuditLog({ actorId: adminUserId, action: "landing_page_block_created", module: "Marketing", targetType: "LandingPageBlock", targetId: block.id });
  return block;
}

async function requireBlockRow(id: string) {
  const block = await landingPageRepository.findBlockById(id);
  if (!block) throw new LandingPageBlockNotFoundError();
  return block;
}

export async function updateBlock(adminUserId: string, blockId: string, input: Partial<LandingPageBlockInput & { visible: boolean }>) {
  await requirePermission(adminUserId, "Marketing", "Edit");
  await requireBlockRow(blockId);
  const block = await landingPageRepository.updateBlock(blockId, input);
  await writeAuditLog({ actorId: adminUserId, action: "landing_page_block_updated", module: "Marketing", targetType: "LandingPageBlock", targetId: blockId });
  return block;
}

export async function deleteBlock(adminUserId: string, blockId: string) {
  await requirePermission(adminUserId, "Marketing", "Edit");
  await requireBlockRow(blockId);
  await landingPageRepository.deleteBlock(blockId);
  await writeAuditLog({ actorId: adminUserId, action: "landing_page_block_deleted", module: "Marketing", targetType: "LandingPageBlock", targetId: blockId });
}

export async function reorderBlocks(adminUserId: string, landingPageId: string, orderedBlockIds: string[]) {
  await requirePermission(adminUserId, "Marketing", "Edit");
  await requireLandingPageRow(landingPageId);
  await landingPageRepository.reorderBlocks(landingPageId, orderedBlockIds);
  await writeAuditLog({ actorId: adminUserId, action: "landing_page_blocks_reordered", module: "Marketing", targetType: "LandingPage", targetId: landingPageId });
}

// --- Storefront-facing ---

export function getPublishedLandingPageBySlug(slug: string) {
  return landingPageRepository.findPublishedLandingPageBySlug(slug);
}
