import type { NotificationChannel, NotificationStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** The only place NotificationTemplate/NotificationPreference/NotificationLog are queried/mutated. */

type Client = Prisma.TransactionClient | typeof prisma;

export function findTemplate(templateKey: string, channel: NotificationChannel, client: Client = prisma) {
  return client.notificationTemplate.findUnique({ where: { templateKey_channel: { templateKey, channel } } });
}

export function findPreferenceByUserId(userId: string, client: Client = prisma) {
  return client.notificationPreference.findUnique({ where: { userId } });
}

export interface UpsertPreferenceInput {
  phone?: string | null;
  emailOptIn?: boolean;
  smsOptIn?: boolean;
  whatsappOptIn?: boolean;
  rewardUpdatesOptIn?: boolean;
}

export function upsertPreference(userId: string, input: UpsertPreferenceInput, client: Client = prisma) {
  return client.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...input },
    update: input,
  });
}

/** The duplicate-send guard's read side — checked before ever calling a provider. */
export function findLogEntry(triggeringEventId: string, templateKey: string, channel: NotificationChannel, recipient: string, client: Client = prisma) {
  return client.notificationLog.findUnique({
    where: { triggeringEventId_templateKey_channel_recipient: { triggeringEventId, templateKey, channel, recipient } },
  });
}

export interface CreateLogInput {
  userId: string | null;
  recipient: string;
  channel: NotificationChannel;
  templateKey: string;
  status: NotificationStatus;
  provider?: string | null;
  providerReference?: string | null;
  error?: string | null;
  triggeringEventId: string;
}

export function createLog(input: CreateLogInput, client: Client = prisma) {
  return client.notificationLog.create({ data: input });
}

export function listLogsForUser(userId: string, client: Client = prisma) {
  return client.notificationLog.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

/** STORY-050d. A campaign's delivery summary — the same NotificationLog rows its send wrote, grouped by status. */
export function getDeliverySummaryByTriggeringEventId(triggeringEventId: string, client: Client = prisma) {
  return client.notificationLog.groupBy({ by: ["status"], where: { triggeringEventId }, _count: true });
}
