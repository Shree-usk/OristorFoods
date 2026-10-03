import { prisma } from "@/lib/db";

/** STORY-053 (additive scope). The only place ContentVersion is queried/mutated. entityType is a free string by design — see schema.prisma's own comment. */

export async function nextVersionNumber(entityType: string, entityId: string): Promise<number> {
  const last = await prisma.contentVersion.findFirst({ where: { entityType, entityId }, orderBy: { versionNumber: "desc" } });
  return (last?.versionNumber ?? 0) + 1;
}

export interface CreateVersionInput {
  entityType: string;
  entityId: string;
  versionNumber: number;
  snapshot: unknown;
  createdById: string | null;
}

export function createVersion(input: CreateVersionInput) {
  return prisma.contentVersion.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      versionNumber: input.versionNumber,
      snapshot: input.snapshot as object,
      createdById: input.createdById,
    },
  });
}

export function listVersions(entityType: string, entityId: string) {
  return prisma.contentVersion.findMany({ where: { entityType, entityId }, orderBy: { versionNumber: "desc" } });
}

export function findVersionById(id: string) {
  return prisma.contentVersion.findUnique({ where: { id } });
}
