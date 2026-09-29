import { prisma } from "@/lib/db";
import type { SupportTicketCategory } from "@/generated/prisma/client";

/** STORY-036. The only place SupportTicket is queried/mutated. */

export interface CreateSupportTicketInput {
  userId: string;
  orderId: string | null;
  category: SupportTicketCategory;
  subject: string;
  message: string;
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
