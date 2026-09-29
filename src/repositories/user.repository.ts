import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-033/034. The only place auth.service.ts/profile.service.ts/security.service.ts read or write the User row. */

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

/** STORY-034. "Log out of all devices" — same invalidation stamp as a password reset, without touching the hash. */
export function bumpSessionVersion(userId: string, client: Client = prisma) {
  return client.user.update({ where: { id: userId }, data: { passwordChangedAt: new Date() } });
}

export interface UpdateProfileInput {
  name?: string | null;
  phone?: string | null;
  dateOfBirth?: Date | null;
  image?: string | null;
  marketingOptIn?: boolean;
}

export function updateProfile(userId: string, input: UpdateProfileInput, client: Client = prisma) {
  return client.user.update({ where: { id: userId }, data: input });
}

/** True if `email` is any user's active email OR another user's pending (unconfirmed) email — both must stay unique. */
export async function isEmailTaken(email: string, excludingUserId: string, client: Client = prisma): Promise<boolean> {
  const existing = await client.user.findFirst({
    where: { id: { not: excludingUserId }, OR: [{ email }, { pendingEmail: email }] },
    select: { id: true },
  });
  return existing !== null;
}

export function setPendingEmail(userId: string, pendingEmail: string, client: Client = prisma) {
  return client.user.update({ where: { id: userId }, data: { pendingEmail } });
}

/** Swaps the confirmed `pendingEmail` into `email`, marks it verified, and clears the pending slot. */
export function confirmPendingEmail(userId: string, email: string, client: Client = prisma) {
  return client.user.update({
    where: { id: userId },
    data: { email, pendingEmail: null, emailVerified: new Date() },
  });
}

export function requestDeactivation(userId: string, reason: string | null, client: Client = prisma) {
  return client.user.update({
    where: { id: userId },
    data: { status: "DeactivationRequested", deactivationReason: reason, deactivationRequestedAt: new Date() },
  });
}
