import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * STORY-057. The `VerificationToken` model's third reuse (STORY-033's
 * password-reset.repository.ts was the first to repurpose it). The
 * identifier is prefixed `admin-invite:` so an invite token can never
 * collide with, or be wiped by, that same email's own customer-side
 * password-reset flow sharing this table.
 */

type Client = Prisma.TransactionClient | typeof prisma;

function identifierFor(email: string): string {
  return `admin-invite:${email}`;
}

export interface CreateInviteTokenInput {
  email: string;
  token: string;
  expires: Date;
}

export function create(input: CreateInviteTokenInput, client: Client = prisma) {
  return client.verificationToken.create({ data: { identifier: identifierFor(input.email), token: input.token, expires: input.expires } });
}

export function findByEmailAndToken(email: string, token: string, client: Client = prisma) {
  return client.verificationToken.findUnique({ where: { identifier_token: { identifier: identifierFor(email), token } } });
}

/** Every outstanding invite token for this email — a resend or an accepted invite invalidates all prior ones. */
export function deleteAllForEmail(email: string, client: Client = prisma) {
  return client.verificationToken.deleteMany({ where: { identifier: identifierFor(email) } });
}
