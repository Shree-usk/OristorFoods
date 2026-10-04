import type { Prisma, ScheduledReportFrequency } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-059c. The only place ScheduledReport is queried/mutated. */

type Client = Prisma.TransactionClient | typeof prisma;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export function listScheduledReports(client: Client = prisma) {
  return client.scheduledReport.findMany({ orderBy: { createdAt: "desc" } });
}

export function findScheduledReportById(id: string, client: Client = prisma) {
  return client.scheduledReport.findUnique({ where: { id } });
}

export interface ScheduledReportInput {
  reportType: string;
  recipients: string[];
  frequency: ScheduledReportFrequency;
}

export function createScheduledReport(input: ScheduledReportInput, createdById: string, client: Client = prisma) {
  return client.scheduledReport.create({ data: { ...input, createdById } });
}

export function updateScheduledReport(id: string, input: Partial<ScheduledReportInput>, client: Client = prisma) {
  return client.scheduledReport.update({ where: { id }, data: input });
}

export function deleteScheduledReport(id: string, client: Client = prisma) {
  return client.scheduledReport.delete({ where: { id } });
}

export function markScheduledReportSent(id: string, sentAt: Date, client: Client = prisma) {
  return client.scheduledReport.update({ where: { id }, data: { lastSentAt: sentAt } });
}

/**
 * "Send due reports now"'s own read. Due = never sent, or last sent
 * further back than its frequency's interval — no cron exists in this
 * codebase (same constraint campaign.repository.ts::listDueCampaigns
 * already documents), so this only reflects what WOULD be due the
 * next time an admin triggers the action.
 */
export function listDueScheduledReports(now: Date, client: Client = prisma) {
  const weeklyCutoff = new Date(now.getTime() - WEEK_MS);
  const monthlyCutoff = new Date(now.getTime() - MONTH_MS);
  return client.scheduledReport.findMany({
    where: {
      OR: [
        { frequency: "Weekly", OR: [{ lastSentAt: null }, { lastSentAt: { lte: weeklyCutoff } }] },
        { frequency: "Monthly", OR: [{ lastSentAt: null }, { lastSentAt: { lte: monthlyCutoff } }] },
      ],
    },
  });
}
