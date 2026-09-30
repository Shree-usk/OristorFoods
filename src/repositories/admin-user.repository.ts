import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-038. The only place AdminUser is queried/mutated. */

type Client = Prisma.TransactionClient | typeof prisma;

export function findByEmail(email: string, client: Client = prisma) {
  return client.adminUser.findUnique({ where: { email }, include: { role: true } });
}

export function findById(id: string, client: Client = prisma) {
  return client.adminUser.findUnique({ where: { id }, include: { role: true } });
}

export interface CreateAdminUserInput {
  email: string;
  name: string;
  passwordHash: string;
  roleId: string;
}

export function create(input: CreateAdminUserInput, client: Client = prisma) {
  return client.adminUser.create({ data: { ...input, passwordChangedAt: new Date() } });
}

/** Bumps `passwordChangedAt` — the admin JWT session's invalidation stamp (see src/lib/admin-auth.ts). Mirrors user.repository.ts::updatePassword. */
export function updatePassword(adminUserId: string, passwordHash: string, client: Client = prisma) {
  return client.adminUser.update({ where: { id: adminUserId }, data: { passwordHash, passwordChangedAt: new Date() } });
}

/** Force-signs-out every outstanding session for this admin without touching the hash. Mirrors user.repository.ts::bumpSessionVersion. */
export function bumpSessionVersion(adminUserId: string, client: Client = prisma) {
  return client.adminUser.update({ where: { id: adminUserId }, data: { passwordChangedAt: new Date() } });
}

export function incrementFailedLoginAttempts(adminUserId: string, client: Client = prisma) {
  return client.adminUser.update({ where: { id: adminUserId }, data: { failedLoginAttempts: { increment: 1 } } });
}

export function resetFailedLoginAttempts(adminUserId: string, client: Client = prisma) {
  return client.adminUser.update({ where: { id: adminUserId }, data: { failedLoginAttempts: 0, lockedUntil: null } });
}

export function lockUntil(adminUserId: string, lockedUntil: Date, client: Client = prisma) {
  return client.adminUser.update({ where: { id: adminUserId }, data: { lockedUntil } });
}

export function countByRoleId(roleId: string, client: Client = prisma) {
  return client.adminUser.count({ where: { roleId, status: "Active" } });
}
