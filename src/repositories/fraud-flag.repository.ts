import type { FraudFlagStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-049. The only place FraudFlag is queried/mutated. */

export interface CreateFlagInput {
  customerId: string;
  type: string;
  details?: Prisma.InputJsonValue;
  relatedRewardTransactionId?: string | null;
  relatedReferralAttributionId?: string | null;
}

export function createFlag(input: CreateFlagInput) {
  return prisma.fraudFlag.create({ data: input });
}

export async function listFlags(status: FraudFlagStatus | undefined, page: number, pageSize: number) {
  const where = status ? { status } : {};
  const [flags, total] = await Promise.all([
    prisma.fraudFlag.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { customer: { select: { name: true, email: true } } },
    }),
    prisma.fraudFlag.count({ where }),
  ]);
  return { flags, total };
}

export function findFlagById(id: string) {
  return prisma.fraudFlag.findUnique({ where: { id } });
}

export function resolveFlag(id: string, status: Extract<FraudFlagStatus, "Approved" | "Reversed">, resolvedById: string) {
  return prisma.fraudFlag.update({ where: { id }, data: { status, resolvedById, resolvedAt: new Date() } });
}
