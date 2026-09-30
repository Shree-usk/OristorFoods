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
