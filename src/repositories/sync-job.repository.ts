import { Prisma } from "@/generated/prisma/client";
import type { SyncJobStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export interface SyncJobFilters {
  jobType?: string;
  status?: SyncJobStatus;
  dateFrom?: Date;
  dateTo?: Date;
  targetEntityId?: string;
}

function whereFromFilters(filters: SyncJobFilters): Prisma.SyncJobWhereInput {
  return {
    ...(filters.jobType ? { jobType: filters.jobType } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.targetEntityId ? { targetEntityId: filters.targetEntityId } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? { createdAt: { ...(filters.dateFrom ? { gte: filters.dateFrom } : {}), ...(filters.dateTo ? { lte: filters.dateTo } : {}) } }
      : {}),
  };
}

export function listJobs(filters: SyncJobFilters) {
  return prisma.syncJob.findMany({ where: whereFromFilters(filters), orderBy: { createdAt: "desc" } });
}

export function findJobById(id: string) {
  return prisma.syncJob.findUnique({ where: { id }, include: { attempts: { orderBy: { attemptNumber: "desc" } } } });
}

export function createJob(input: {
  jobType: string;
  targetEntityType: string | null;
  targetEntityId: string | null;
  payload: Prisma.InputJsonValue | null;
  createdById: string;
}) {
  return prisma.syncJob.create({ data: { ...input, payload: input.payload ?? Prisma.JsonNull } });
}

export function updateJobStatus(id: string, data: { status: SyncJobStatus; errorMessage?: string | null; attemptCount?: number; nextRetryAt?: Date | null }) {
  return prisma.syncJob.update({ where: { id }, data });
}

export function createAttempt(input: { jobId: string; attemptNumber: number; result: SyncJobStatus; errorDetail: string | null; completedAt: Date }) {
  return prisma.syncJobAttempt.create({ data: input });
}

export async function getTodaySummary() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [queued, failed, succeededToday] = await Promise.all([
    prisma.syncJob.count({ where: { status: "Queued" } }),
    prisma.syncJob.count({ where: { status: "Failed" } }),
    prisma.syncJob.count({ where: { status: "Success", updatedAt: { gte: startOfToday } } }),
  ]);

  return { queued, failed, succeededToday };
}
