import { prisma } from "@/lib/db";

/** STORY-048. The only place LoginEvent is queried/mutated. */

export interface CreateLoginEventInput {
  userId: string;
  success: boolean;
  ipAddress: string | null;
  userAgent: string | null;
}

export function createLoginEvent(input: CreateLoginEventInput) {
  return prisma.loginEvent.create({ data: input });
}

export async function findLoginEventsByUserId(userId: string, page: number, pageSize: number) {
  const [events, total] = await Promise.all([
    prisma.loginEvent.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.loginEvent.count({ where: { userId } }),
  ]);
  return { events, total };
}
