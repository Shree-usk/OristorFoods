import type { CustomerGroup, PopupInteractionType, PopupPageTarget, PopupStatus } from "@/generated/prisma/client";
import * as popupRepository from "@/repositories/popup.repository";
import type { PopupContentInput } from "@/repositories/popup.repository";
import * as popupInteractionRepository from "@/repositories/popup-interaction.repository";
import * as referralRepository from "@/repositories/referral.repository";
import * as rewardsRepository from "@/repositories/rewards.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { IllegalPopupStatusTransitionError, PopupNotFoundError } from "@/services/popup.errors";
import { requirePermission } from "@/services/permission.service";

/**
 * STORY-050a. Promotional Pop-up Manager. Permission gating mirrors every
 * other admin console this session built: View for reads, Edit for
 * content/scheduling changes and low-risk status moves (pausing,
 * archiving), Approve specifically for whatever makes a popup live or
 * takes it down (publish, resume-from-pause into Published, unpublish) —
 * the same money/visibility-moving bar STORY-047's refund and STORY-048's
 * reward grant already use, not the AC source doc's own suggested
 * granular PROMOTION_PUBLISH/PAUSE/ARCHIVE permission set.
 */

// --- Admin CRUD ---

export async function listPopupsForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "Marketing", "View");
  return popupRepository.listPopupsForAdmin();
}

async function requirePopupRow(id: string) {
  const popup = await popupRepository.findPopupById(id);
  if (!popup) throw new PopupNotFoundError();
  return popup;
}

export async function getPopupAdminDetail(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "Marketing", "View");
  return requirePopupRow(id);
}

export async function createPopup(adminUserId: string, input: PopupContentInput) {
  await requirePermission(adminUserId, "Marketing", "Edit");
  const popup = await popupRepository.createPopup(input, adminUserId);
  await writeAuditLog({ actorId: adminUserId, action: "popup_created", module: "Marketing", targetType: "PromotionalPopup", targetId: popup.id });
  return popup;
}

export async function updatePopup(adminUserId: string, id: string, input: Partial<PopupContentInput>) {
  await requirePermission(adminUserId, "Marketing", "Edit");
  await requirePopupRow(id);
  const popup = await popupRepository.updatePopup(id, input);
  await writeAuditLog({ actorId: adminUserId, action: "popup_updated", module: "Marketing", targetType: "PromotionalPopup", targetId: id });
  return popup;
}

// --- Status workflow (source doc §9: Draft -> Scheduled -> Published -> Paused -> Unpublished/Archived) ---

const EDIT_TRANSITIONS: Partial<Record<PopupStatus, PopupStatus[]>> = {
  Draft: ["Scheduled", "Archived"],
  Scheduled: ["Draft", "Archived"],
  Paused: ["Draft", "Archived"],
  Published: ["Paused"],
  Unpublished: ["Draft", "Archived"],
};

const APPROVE_TRANSITIONS: Partial<Record<PopupStatus, PopupStatus[]>> = {
  Draft: ["Published"],
  Scheduled: ["Published"],
  Paused: ["Published"],
  Published: ["Unpublished"],
};

export async function changePopupStatus(adminUserId: string, id: string, to: PopupStatus) {
  const popup = await requirePopupRow(id);
  const from = popup.status;

  if (EDIT_TRANSITIONS[from]?.includes(to)) {
    await requirePermission(adminUserId, "Marketing", "Edit");
  } else if (APPROVE_TRANSITIONS[from]?.includes(to)) {
    await requirePermission(adminUserId, "Marketing", "Approve");
  } else {
    throw new IllegalPopupStatusTransitionError(from, to);
  }

  const updated = await popupRepository.updatePopupStatus(id, to);
  await writeAuditLog({ actorId: adminUserId, action: "popup_status_changed", module: "Marketing", targetType: "PromotionalPopup", targetId: id, metadata: { from, to } });
  return updated;
}

export async function getPerformanceSummary(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "Marketing", "View");
  await requirePopupRow(id);
  return popupInteractionRepository.getPerformanceSummary(id);
}

// --- Storefront-facing eligibility resolution ---

export interface PopupEligibilityContext {
  pageTarget: PopupPageTarget;
  userId: string | null;
  customerGroup: CustomerGroup | null;
  now?: Date;
}

function frequencyWindowMs(cap: string): number | null {
  switch (cap) {
    case "OncePerDay":
      return 24 * 60 * 60 * 1000;
    case "OncePerWeek":
      return 7 * 24 * 60 * 60 * 1000;
    default:
      return null; // OncePerSession (client-side only), OncePerCustomer/UntilDismissed (ever, not windowed)
  }
}

async function matchesAudience(popup: { audienceTarget: string; targetCustomerGroup: string | null }, context: PopupEligibilityContext): Promise<boolean> {
  switch (popup.audienceTarget) {
    case "AllVisitors":
      return true;
    case "Authenticated":
      return context.userId !== null;
    case "CustomerGroupTarget":
      return context.userId !== null && popup.targetCustomerGroup !== null && context.customerGroup === popup.targetCustomerGroup;
    case "LoyaltyMembers": {
      if (!context.userId) return false;
      const { lifetimeAchievement } = await rewardsRepository.getBalances(context.userId);
      return lifetimeAchievement > 0;
    }
    case "ReferralMembers": {
      if (!context.userId) return false;
      const [asReferrer, asReferred] = await Promise.all([
        referralRepository.listAttributionsForReferrer(context.userId),
        referralRepository.findAttributionByReferredUserId(context.userId),
      ]);
      return asReferrer.length > 0 || asReferred !== null;
    }
    // NewVisitors/ReturningVisitors: no server-side visitor identity exists to check against
    // (confirmed: no session-tracking infra) — resolved as a best-effort client-side cookie
    // check instead, so the server treats both as "don't exclude," same as AllVisitors.
    case "NewVisitors":
    case "ReturningVisitors":
      return true;
    default:
      return false;
  }
}

/** Authenticated customers only — real, server-side enforcement. Guests get OncePerSession-equivalent behavior client-side (localStorage), documented as the honest limit given no guest-identity architecture exists. */
async function passesFrequencyCap(popupId: string, userId: string, cap: string, now: Date): Promise<boolean> {
  if (cap === "UntilDismissed") {
    const dismissed = await popupInteractionRepository.countInteractionsEver(popupId, userId, "Dismissal");
    return dismissed === 0;
  }
  if (cap === "OncePerCustomer") {
    const seen = await popupInteractionRepository.countInteractionsEver(popupId, userId, "Impression");
    return seen === 0;
  }
  const windowMs = frequencyWindowMs(cap);
  if (windowMs === null) return true; // OncePerSession — client-side only, nothing to check server-side
  const since = new Date(now.getTime() - windowMs);
  const seen = await popupInteractionRepository.countInteractionsSince(popupId, userId, "Impression", since);
  return seen === 0;
}

/**
 * Pure-ish resolution over already-fetched state — mirrors
 * reward-campaign.service.ts::resolveActiveMultiplier's shape from
 * STORY-049. Returns at most one popup: among every Published, in-window,
 * page/audience-matching popup, picks the eligible one with the newest
 * schedule start (a simple, explainable tie-break when more than one
 * independent popup qualifies), then — if that popup has A/B siblings —
 * weighted-picks among the variant group.
 */
export async function resolveEligiblePopup(context: PopupEligibilityContext) {
  const now = context.now ?? new Date();
  const candidates = await popupRepository.findEligiblePopups(context.pageTarget, now);
  if (candidates.length === 0) return null;

  const audienceMatched = [];
  for (const popup of candidates) {
    if (await matchesAudience(popup, context)) audienceMatched.push(popup);
  }
  if (audienceMatched.length === 0) return null;

  const frequencyPassed = [];
  for (const popup of audienceMatched) {
    if (!context.userId || (await passesFrequencyCap(popup.id, context.userId, popup.frequencyCap, now))) frequencyPassed.push(popup);
  }
  if (frequencyPassed.length === 0) return null;

  const winner = frequencyPassed.reduce((latest, popup) => (!latest || (popup.startAt ?? popup.createdAt) > (latest.startAt ?? latest.createdAt) ? popup : latest));

  if (!winner.variantGroupId) return winner;

  const siblings = await popupRepository.findVariantSiblings(winner.variantGroupId);
  const eligibleSiblingIds = new Set(frequencyPassed.filter((popup) => popup.variantGroupId === winner.variantGroupId).map((popup) => popup.id));
  const pool = siblings.filter((popup) => eligibleSiblingIds.has(popup.id));
  if (pool.length <= 1) return winner;

  const totalWeight = pool.reduce((sum, popup) => sum + popup.variantWeight, 0);
  let roll = Math.random() * totalWeight;
  for (const popup of pool) {
    roll -= popup.variantWeight;
    if (roll <= 0) return popup;
  }
  return pool[pool.length - 1];
}

export async function recordInteraction(popupId: string, userId: string | null, type: PopupInteractionType): Promise<void> {
  await popupInteractionRepository.createInteraction(popupId, userId, type);
}
