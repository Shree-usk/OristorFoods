import type { AdminUserStatus, Prisma } from "@/generated/prisma/client";
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

// --- STORY-057. Admin console CRUD ---

export function listAll(client: Client = prisma) {
  return client.adminUser.findMany({ include: { role: true }, orderBy: { email: "asc" } });
}

export interface UpdateAdminUserInput {
  name?: string;
  roleId?: string;
}

export function update(adminUserId: string, input: UpdateAdminUserInput, client: Client = prisma) {
  return client.adminUser.update({ where: { id: adminUserId }, data: input, include: { role: true } });
}

export function updateStatus(adminUserId: string, status: AdminUserStatus, client: Client = prisma) {
  return client.adminUser.update({ where: { id: adminUserId }, data: { status }, include: { role: true } });
}

export function deleteAdminUser(adminUserId: string, client: Client = prisma) {
  return client.adminUser.delete({ where: { id: adminUserId } });
}

/** The most recent "login_succeeded" AuditLog timestamp per actor, for the Users list's "last login" column — there's no dedicated AdminUser.lastLoginAt field, admin-auth.service.ts already writes this event on every successful login. */
export async function listLastLoginTimestamps(client: Client = prisma): Promise<Map<string, Date>> {
  const rows = await client.auditLog.groupBy({
    by: ["actorId"],
    where: { action: "login_succeeded", actorId: { not: null } },
    _max: { createdAt: true },
  });
  const result = new Map<string, Date>();
  for (const row of rows) {
    if (row.actorId && row._max.createdAt) result.set(row.actorId, row._max.createdAt);
  }
  return result;
}
