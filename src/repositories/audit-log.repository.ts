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
