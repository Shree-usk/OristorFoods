import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * STORY-033. Repurposes the Prisma/Auth.js `VerificationToken` model
 * (identifier/token/expires, unused until now) for password-reset tokens
 * — `token` stores a SHA-256 hash of the raw token mailed to the
 * customer, never the raw value itself (see auth.service.ts).
 */

type Client = Prisma.TransactionClient | typeof prisma;

export interface CreateResetTokenInput {
  identifier: string;
  token: string;
  expires: Date;
}

export function create(input: CreateResetTokenInput, client: Client = prisma) {
  return client.verificationToken.create({ data: input });
}

export function findByIdentifierAndToken(identifier: string, token: string, client: Client = prisma) {
  return client.verificationToken.findUnique({ where: { identifier_token: { identifier, token } } });
}

/** Every outstanding token for this identifier — a fresh request or a completed reset invalidates all prior ones. */
export function deleteAllForIdentifier(identifier: string, client: Client = prisma) {
  return client.verificationToken.deleteMany({ where: { identifier } });
}
