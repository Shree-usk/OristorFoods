import type { EmailSmsCampaign, NotificationChannel } from "@/generated/prisma/client";
import * as campaignRepository from "@/repositories/campaign.repository";
import type { CampaignContentInput } from "@/repositories/campaign.repository";
import * as audienceRepository from "@/repositories/campaign-audience.repository";
import type { CampaignRecipientCandidate } from "@/repositories/campaign-audience.repository";
import * as notificationRepository from "@/repositories/notification.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { CampaignNotFoundError, IllegalCampaignEditError, IllegalCampaignSendError } from "@/services/campaign.errors";
import { resolveSegmentMembers } from "@/services/crm-segmentation.service";
import { renderTemplate, sendCampaignMessage } from "@/services/notification.service";
import { requirePermission } from "@/services/permission.service";

/**
 * STORY-050d. Email/SMS/WhatsApp campaign builder. Permission gating
 * mirrors every other admin console this session built: View for
 * reads, Edit for draft content/schedule, Approve specifically for
 * whatever actually dispatches messages to real customers
 * (sendCampaignNow/processDueCampaigns) — the same money/visibility-
 * moving bar STORY-047's refund and STORY-050a's publish already use.
 *
 * "Schedule for later" has no cron to fire it — this codebase has none
 * anywhere, and hosting/cloud provider is still unconfirmed (see
 * docs/blueprint.md Section 10). A Scheduled campaign only actually
 * sends when an admin explicitly triggers processDueCampaigns.
 */

// --- Admin CRUD ---

export async function listCampaignsForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "Marketing", "View");
  return campaignRepository.listCampaignsForAdmin();
}

async function requireCampaignRow(id: string) {
  const campaign = await campaignRepository.findCampaignById(id);
  if (!campaign) throw new CampaignNotFoundError();
  return campaign;
}

export async function getCampaignAdminDetail(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "Marketing", "View");
  return requireCampaignRow(id);
}

export async function createCampaign(adminUserId: string, input: CampaignContentInput) {
  await requirePermission(adminUserId, "Marketing", "Edit");
  const campaign = await campaignRepository.createCampaign(input, adminUserId);
  await writeAuditLog({ actorId: adminUserId, action: "campaign_created", module: "Marketing", targetType: "EmailSmsCampaign", targetId: campaign.id, metadata: { channel: campaign.channel } });
  return campaign;
}

export async function updateCampaign(adminUserId: string, id: string, input: Partial<CampaignContentInput>) {
  await requirePermission(adminUserId, "Marketing", "Edit");
  const existing = await requireCampaignRow(id);
  if (existing.status === "Sent") throw new IllegalCampaignEditError();
  const campaign = await campaignRepository.updateCampaign(id, input);
  await writeAuditLog({ actorId: adminUserId, action: "campaign_updated", module: "Marketing", targetType: "EmailSmsCampaign", targetId: id });
  return campaign;
}

// --- Audience resolution ---

interface ResolvedRecipient {
  userId: string;
  name: string | null;
  recipient: string;
}

function contactForChannel(candidate: CampaignRecipientCandidate, channel: NotificationChannel): string | null {
  if (channel === "Email") return candidate.marketingOptIn && candidate.email ? candidate.email : null;
  if (channel === "SMS") return candidate.notificationPreference?.smsOptIn && candidate.notificationPreference.phone ? candidate.notificationPreference.phone : null;
  return candidate.notificationPreference?.whatsappOptIn && candidate.notificationPreference.phone ? candidate.notificationPreference.phone : null;
}

async function resolveCandidates(campaign: Pick<EmailSmsCampaign, "audienceTarget" | "targetCustomerGroup" | "targetSegmentId">): Promise<CampaignRecipientCandidate[]> {
  switch (campaign.audienceTarget) {
    case "AllCustomers":
      return audienceRepository.listAllCustomers();
    case "CustomerGroupTarget":
      return campaign.targetCustomerGroup ? audienceRepository.listCustomersByGroup(campaign.targetCustomerGroup) : [];
    case "LoyaltyMembers": {
      const ids = await audienceRepository.listLoyaltyMemberUserIds();
      return ids.length > 0 ? audienceRepository.listCustomersByIds(ids) : [];
    }
    case "ReferralMembers": {
      const ids = await audienceRepository.listReferralMemberUserIds();
      return ids.length > 0 ? audienceRepository.listCustomersByIds(ids) : [];
    }
    case "SavedSegment": {
      if (!campaign.targetSegmentId) return [];
      const ids = await resolveSegmentMembers(campaign.targetSegmentId);
      return ids.length > 0 ? audienceRepository.listCustomersByIds(ids) : [];
    }
    default:
      return [];
  }
}

/** Segment lookup, then filtered down to actually-contactable + opted-in recipients for the campaign's own channel. */
async function resolveRecipients(campaign: Pick<EmailSmsCampaign, "audienceTarget" | "targetCustomerGroup" | "targetSegmentId" | "channel">): Promise<ResolvedRecipient[]> {
  const candidates = await resolveCandidates(campaign);
  const resolved: ResolvedRecipient[] = [];
  for (const candidate of candidates) {
    const recipient = contactForChannel(candidate, campaign.channel);
    if (recipient) resolved.push({ userId: candidate.id, name: candidate.name, recipient });
  }
  return resolved;
}

// --- Sending ---

async function dispatchCampaign(campaign: EmailSmsCampaign): Promise<{ recipientCount: number }> {
  const recipients = await resolveRecipients(campaign);
  for (const recipient of recipients) {
    const variables = { name: recipient.name ?? "Customer" };
    const subject = campaign.subject ? renderTemplate(campaign.subject, variables) : null;
    const body = renderTemplate(campaign.body, variables);
    try {
      await sendCampaignMessage({ campaignId: campaign.id, userId: recipient.userId, recipient: recipient.recipient, channel: campaign.channel, subject, body });
    } catch (error) {
      // One recipient's failure never aborts the rest of the batch — mirrors notification.service.ts::sendNotification's per-channel isolation.
      console.error(`[email-sms-campaign] failed to send campaign ${campaign.id} to ${recipient.userId}`, error);
    }
  }
  await campaignRepository.markCampaignSent(campaign.id, new Date());
  return { recipientCount: recipients.length };
}

export async function sendCampaignNow(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "Marketing", "Approve");
  const campaign = await requireCampaignRow(id);
  if (campaign.status === "Sent") throw new IllegalCampaignSendError();

  const { recipientCount } = await dispatchCampaign(campaign);
  await writeAuditLog({ actorId: adminUserId, action: "campaign_sent", module: "Marketing", targetType: "EmailSmsCampaign", targetId: id, metadata: { recipientCount } });
  return requireCampaignRow(id);
}

export async function processDueCampaigns(adminUserId: string) {
  await requirePermission(adminUserId, "Marketing", "Approve");
  const due = await campaignRepository.listDueCampaigns(new Date());

  const results: { campaignId: string; recipientCount: number }[] = [];
  for (const campaign of due) {
    const { recipientCount } = await dispatchCampaign(campaign);
    results.push({ campaignId: campaign.id, recipientCount });
  }

  if (results.length > 0) {
    await writeAuditLog({ actorId: adminUserId, action: "campaigns_processed_due", module: "Marketing", metadata: { results } });
  }
  return { processed: results.length, results };
}

// --- Performance ---

export async function getCampaignDeliverySummary(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "Marketing", "View");
  await requireCampaignRow(id);
  const rows = await notificationRepository.getDeliverySummaryByTriggeringEventId(id);
  const summary = { sent: 0, failed: 0, skippedNoConsent: 0 };
  for (const row of rows) {
    if (row.status === "Sent") summary.sent = row._count;
    else if (row.status === "Failed") summary.failed = row._count;
    else if (row.status === "SkippedNoConsent") summary.skippedNoConsent = row._count;
  }
  return summary;
}
