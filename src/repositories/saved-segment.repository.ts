import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-059a. The only place SavedSegment is queried/mutated. */

export interface CreateSavedSegmentInput {
  name: string;
  filterCriteria: Prisma.InputJsonValue;
  createdById: string;
}

export function create(input: CreateSavedSegmentInput) {
  return prisma.savedSegment.create({ data: input });
}

export function listAll() {
  return prisma.savedSegment.findMany({ include: { createdBy: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" } });
}

export function findById(id: string) {
  return prisma.savedSegment.findUnique({ where: { id }, include: { createdBy: { select: { id: true, name: true, email: true } } } });
}

export interface UpdateSavedSegmentInput {
  name?: string;
  filterCriteria?: Prisma.InputJsonValue;
}

export function update(id: string, input: UpdateSavedSegmentInput) {
  return prisma.savedSegment.update({ where: { id }, data: input });
}

export function deleteSegment(id: string) {
  return prisma.savedSegment.delete({ where: { id } });
}
