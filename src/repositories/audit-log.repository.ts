import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-038. The only place AuditLog is queried/mutated — shared by this story's own auth/permission events and every future admin-module story's create/edit/delete/approve actions. */

export interface CreateAuditLogInput {
  actorId: string | null;
  action: string;
  module?: Prisma.AuditLogCreateInput["module"];
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
}

export function create(input: CreateAuditLogInput) {
  return prisma.auditLog.create({ data: input });
}

// --- STORY-057. Audit Log viewer ---

export interface AuditLogFilters {
  actorId?: string;
  module?: Prisma.AuditLogWhereInput["module"];
  action?: string;
  dateFrom?: Date;
  dateTo?: Date;
  targetId?: string;
}

function whereFromFilters(filters: AuditLogFilters): Prisma.AuditLogWhereInput {
  return {
    ...(filters.actorId ? { actorId: filters.actorId } : {}),
    ...(filters.module ? { module: filters.module } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.targetId ? { targetId: filters.targetId } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? { createdAt: { ...(filters.dateFrom ? { gte: filters.dateFrom } : {}), ...(filters.dateTo ? { lte: filters.dateTo } : {}) } }
      : {}),
  };
}

const PAGE_SIZE = 50;
/** A generous ceiling, not a real pagination limit — export is a one-shot CSV download, not a browsable list. */
const MAX_EXPORT_ROWS = 10_000;

export async function list(filters: AuditLogFilters, page: number) {
  const where = whereFromFilters(filters);
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { rows, total, page, pageSize: PAGE_SIZE };
}

export function listForExport(filters: AuditLogFilters) {
  return prisma.auditLog.findMany({
    where: whereFromFilters(filters),
    include: { actor: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
    take: MAX_EXPORT_ROWS,
  });
}
