import { prisma } from "@/lib/db";
import type { SupportTicketCategory, SupportTicketSource, SupportTicketStatus } from "@/generated/prisma/client";

/** STORY-036 (extended STORY-063). The only place SupportTicket is queried/mutated. */

export interface CreateSupportTicketInput {
  userId: string;
  orderId: string | null;
  category: SupportTicketCategory;
  subject: string;
  message: string;
  /** STORY-063. Optional — existing callers omit both and get the model's Customer/null defaults. */
  source?: SupportTicketSource;
  conversationId?: string;
}

export function createSupportTicket(input: CreateSupportTicketInput) {
  return prisma.supportTicket.create({ data: input });
}

export async function findSupportTicketsByUserId(userId: string, page: number, pageSize: number) {
  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.supportTicket.count({ where: { userId } }),
  ]);
  return { tickets, total };
}

export function findSupportTicketById(id: string) {
  return prisma.supportTicket.findUnique({ where: { id } });
}

/**
 * STORY-039. Dashboard's Support Tickets widget. SupportTicket has no
 * `priority` field, so this breaks down by `status` instead of the story's
 * "by priority" wording — see docs/architecture-decisions.md.
 */
export async function countTicketsByStatus() {
  const groups = await prisma.supportTicket.groupBy({ by: ["status"], _count: { _all: true } });
  const countFor = (status: SupportTicketStatus) => groups.find((group) => group.status === status)?._count._all ?? 0;
  return {
    open: countFor("Open"),
    inProgress: countFor("InProgress"),
    resolved: countFor("Resolved"),
    closed: countFor("Closed"),
  };
}
