import type { StoryPage } from "@/generated/prisma/client";
import * as storyPageRepository from "@/repositories/story-page.repository";
import type { StoryPageBlockUpsertInput } from "@/repositories/story-page.repository";
import * as systemSettingsRepository from "@/repositories/system-settings.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { requirePermission } from "@/services/permission.service";

/** STORY-074. Admin-editable content blocks for static storefront pages (currently About Us only). */

export async function getStoryPageBlocksForAdmin(adminUserId: string, page: StoryPage) {
  await requirePermission(adminUserId, "StoryPages", "View");
  return storyPageRepository.listBlocksForPage(page);
}

export async function saveStoryPageBlocks(adminUserId: string, page: StoryPage, blocks: StoryPageBlockUpsertInput[]) {
  await requirePermission(adminUserId, "StoryPages", "Edit");
  const result = await storyPageRepository.replaceBlocksForPage(page, blocks);
  await writeAuditLog({ actorId: adminUserId, action: "story_page_blocks_updated", module: "StoryPages", targetType: "StoryPageBlock", targetId: page });
  return result;
}

/** Storefront-facing — no permission check. Called server-side only, from the page's own Server Component. */
export function getPublishedStoryBlocks(page: StoryPage) {
  return storyPageRepository.listBlocksForPage(page);
}

export interface ContactPageCopyInput {
  contactHeroEyebrow?: string | null;
  contactHeroHeadline?: string | null;
  contactHeroSubcopy?: string | null;
  contactLocationHeading?: string | null;
}

/**
 * Contact page's 4 strings live on CompanySetting (see
 * system-settings.service.ts), but are gated on StoryPages here, not
 * SystemSettings — a role granted StoryPages (e.g. content_editor) edits
 * both this admin page's tabs under one permission, never silently
 * blocked on the Contact tab for lacking an unrelated module.
 */
export async function getContactPageCopyForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "StoryPages", "View");
  return systemSettingsRepository.getCompanySetting();
}

export async function saveContactPageCopy(adminUserId: string, input: ContactPageCopyInput) {
  await requirePermission(adminUserId, "StoryPages", "Edit");
  const updated = await systemSettingsRepository.updateCompanySetting(input);
  await writeAuditLog({ actorId: adminUserId, action: "contact_page_copy_updated", module: "StoryPages", targetType: "CompanySetting", targetId: "global" });
  return updated;
}
