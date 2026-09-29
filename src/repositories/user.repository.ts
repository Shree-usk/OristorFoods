import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-033. The only place auth.service.ts reads/writes the User row. */

type Client = Prisma.TransactionClient | typeof prisma;

export function findByEmail(email: string, client: Client = prisma) {
  return client.user.findUnique({ where: { email } });
}

export function findById(userId: string, client: Client = prisma) {
  return client.user.findUnique({ where: { id: userId } });
}

export interface CreateUserInput {
  name: string | null;
  email: string;
  passwordHash: string;
  marketingOptIn: boolean;
  passwordChangedAt: Date;
}

export function create(input: CreateUserInput, client: Client = prisma) {
  return client.user.create({ data: input });
}

/** Bumps `passwordChangedAt` alongside the hash — the JWT session's invalidation stamp (see src/lib/auth.ts). */
export function updatePassword(userId: string, passwordHash: string, client: Client = prisma) {
  return client.user.update({ where: { id: userId }, data: { passwordHash, passwordChangedAt: new Date() } });
}
