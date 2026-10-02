import type { CampaignAudienceTarget, CustomerGroup, NotificationChannel, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-050d. The only place EmailSmsCampaign is queried/mutated. */

type Client = Prisma.TransactionClient | typeof prisma;

export function listCampaignsForAdmin(client: Client = prisma) {
  return client.emailSmsCampaign.findMany({ orderBy: { createdAt: "desc" } });
}

export function findCampaignById(id: string, client: Client = prisma) {
  return client.emailSmsCampaign.findUnique({ where: { id } });
}

export interface CampaignContentInput {
  name: string;
  channel: NotificationChannel;
  audienceTarget: CampaignAudienceTarget;
  targetCustomerGroup: CustomerGroup | null;
  subject: string | null;
  body: string;
  scheduledAt: Date | null;
}

export function createCampaign(input: CampaignContentInput, createdById: string, client: Client = prisma) {
  return client.emailSmsCampaign.create({ data: { ...input, createdById } });
}

export function updateCampaign(id: string, input: Partial<CampaignContentInput>, client: Client = prisma) {
  return client.emailSmsCampaign.update({ where: { id }, data: input });
}

export function markCampaignSent(id: string, sentAt: Date, client: Client = prisma) {
  return client.emailSmsCampaign.update({ where: { id }, data: { status: "Sent", sentAt } });
}

/** "Send due campaigns"'s own read — Scheduled, past its scheduledAt. */
export function listDueCampaigns(now: Date, client: Client = prisma) {
  return client.emailSmsCampaign.findMany({ where: { status: "Scheduled", scheduledAt: { lte: now } } });
}
