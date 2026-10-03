import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-038. The only place Role/RolePermission are queried/mutated. */

type Client = Prisma.TransactionClient | typeof prisma;

export function findByKey(key: string, client: Client = prisma) {
  return client.role.findUnique({ where: { key } });
}

export function findById(id: string, client: Client = prisma) {
  return client.role.findUnique({ where: { id } });
}

export function listAll(client: Client = prisma) {
  return client.role.findMany({ orderBy: { name: "asc" } });
}

export function findPermissionsForRole(roleId: string, client: Client = prisma) {
  return client.rolePermission.findMany({ where: { roleId } });
}

// --- STORY-057. Role management CRUD ---

export function create(key: string, name: string, client: Client = prisma) {
  return client.role.create({ data: { key, name } });
}

export function deleteRole(id: string, client: Client = prisma) {
  return client.role.delete({ where: { id } });
}

export interface RolePermissionEntry {
  module: Prisma.RolePermissionCreateManyInput["module"];
  action: Prisma.RolePermissionCreateManyInput["action"];
}

/** Replaces this role's entire permission set wholesale — the standard "replace a join table" shape (deleteMany + create) this codebase already uses for coupon.repository.ts's scope tables. */
export function replacePermissions(roleId: string, entries: RolePermissionEntry[], client: Client = prisma) {
  return client.role.update({
    where: { id: roleId },
    data: { permissions: { deleteMany: {}, create: entries.map((entry) => ({ module: entry.module, action: entry.action })) } },
  });
}

/** Copies every permission row from one role onto another — used by cloneRole(). */
export async function copyPermissions(fromRoleId: string, toRoleId: string, client: Client = prisma) {
  const source = await client.rolePermission.findMany({ where: { roleId: fromRoleId } });
  if (source.length === 0) return;
  await client.rolePermission.createMany({ data: source.map((row) => ({ roleId: toRoleId, module: row.module, action: row.action })) });
}
