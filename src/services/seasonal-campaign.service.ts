import type { SeasonalCampaignStatus } from "@/generated/prisma/client";
import * as seasonalCampaignRepository from "@/repositories/seasonal-campaign.repository";
import type { SeasonalCampaignContentInput } from "@/repositories/seasonal-campaign.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { getCampaignDeliverySummary } from "@/services/email-sms-campaign.service";
import { getPerformanceSummary as getPopupPerformanceSummary } from "@/services/popup.service";
import { requirePermission } from "@/services/permission.service";
import { IllegalSeasonalCampaignStatusTransitionError, SeasonalCampaignNotFoundError } from "@/services/seasonal-campaign.errors";

/**
 * STORY-050c. Seasonal Campaign Hub — a pure linking + reporting record
 * over already-built pieces (PromotionalPopup, Coupon, EmailSmsCampaign,
 * HomepageSection), not a new orchestration layer. See the model's own
 * schema.prisma comment and docs/architecture-decisions.md for the full
 * "no cascading side effects" reasoning. Permission gating mirrors every
 * other admin console this session built (see popup.service.ts): View
 * for reads, Edit for content/date changes and low-risk status moves,
 * Approve for whatever makes the hub live or ends it.
 */

// --- Admin CRUD ---

export async function listSeasonalCampaignsForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "Marketing", "View");
  return seasonalCampaignRepository.listSeasonalCampaignsForAdmin();
}

async function requireSeasonalCampaignRow(id: string) {
  const campaign = await seasonalCampaignRepository.findSeasonalCampaignById(id);
  if (!campaign) throw new SeasonalCampaignNotFoundError();
  return campaign;
}

export async function getSeasonalCampaignAdminDetail(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "Marketing", "View");
  return requireSeasonalCampaignRow(id);
}

export async function createSeasonalCampaign(adminUserId: string, input: SeasonalCampaignContentInput) {
  await requirePermission(adminUserId, "Marketing", "Edit");
  const campaign = await seasonalCampaignRepository.createSeasonalCampaign(input, adminUserId);
  await writeAuditLog({ actorId: adminUserId, action: "seasonal_campaign_created", module: "Marketing", targetType: "SeasonalCampaign", targetId: campaign.id });
  return campaign;
}

export async function updateSeasonalCampaign(adminUserId: string, id: string, input: Partial<SeasonalCampaignContentInput>) {
  await requirePermission(adminUserId, "Marketing", "Edit");
  await requireSeasonalCampaignRow(id);
  const campaign = await seasonalCampaignRepository.updateSeasonalCampaign(id, input);
  await writeAuditLog({ actorId: adminUserId, action: "seasonal_campaign_updated", module: "Marketing", targetType: "SeasonalCampaign", targetId: id });
  return campaign;
}

// --- Status workflow (Draft -> Scheduled -> Active -> Ended, Archived as a terminal housekeeping move from anywhere) ---

const EDIT_TRANSITIONS: Partial<Record<SeasonalCampaignStatus, SeasonalCampaignStatus[]>> = {
  Draft: ["Scheduled", "Archived"],
  Scheduled: ["Draft", "Archived"],
  Ended: ["Archived"],
};

const APPROVE_TRANSITIONS: Partial<Record<SeasonalCampaignStatus, SeasonalCampaignStatus[]>> = {
  Scheduled: ["Active"],
  Active: ["Ended"],
};

export async function changeSeasonalCampaignStatus(adminUserId: string, id: string, to: SeasonalCampaignStatus) {
  const campaign = await requireSeasonalCampaignRow(id);
  const from = campaign.status;

  if (EDIT_TRANSITIONS[from]?.includes(to)) {
    await requirePermission(adminUserId, "Marketing", "Edit");
  } else if (APPROVE_TRANSITIONS[from]?.includes(to)) {
    await requirePermission(adminUserId, "Marketing", "Approve");
  } else {
    throw new IllegalSeasonalCampaignStatusTransitionError(from, to);
  }

  const updated = await seasonalCampaignRepository.updateSeasonalCampaignStatus(id, to);
  await writeAuditLog({ actorId: adminUserId, action: "seasonal_campaign_status_changed", module: "Marketing", targetType: "SeasonalCampaign", targetId: id, metadata: { from, to } });
  return updated;
}

// --- Performance (per-channel breakdown, not one blended number — impressions/clicks/conversions aren't comparable across channels) ---

export interface SeasonalCampaignPerformanceSummary {
  popup: { impressions: number; clicks: number; dismissals: number } | null;
  coupon: { redemptions: number } | null;
  emailSmsCampaign: { sent: number; failed: number; skippedNoConsent: number } | null;
}

export async function getSeasonalCampaignPerformanceSummary(adminUserId: string, id: string): Promise<SeasonalCampaignPerformanceSummary> {
  await requirePermission(adminUserId, "Marketing", "View");
  const campaign = await requireSeasonalCampaignRow(id);

  const [popup, coupon, emailSmsCampaign] = await Promise.all([
    campaign.popupId ? getPopupPerformanceSummary(adminUserId, campaign.popupId) : Promise.resolve(null),
    campaign.couponId ? seasonalCampaignRepository.countRedemptionsForCoupon(campaign.couponId).then((redemptions) => ({ redemptions })) : Promise.resolve(null),
    campaign.emailSmsCampaignId ? getCampaignDeliverySummary(adminUserId, campaign.emailSmsCampaignId) : Promise.resolve(null),
  ]);

  return { popup, coupon, emailSmsCampaign };
}
