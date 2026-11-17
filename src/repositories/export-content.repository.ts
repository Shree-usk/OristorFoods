import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** /export page revamp. The only place ExportPageHeroSetting/ExportSolutionCard/ExportProcessStep are queried/mutated — flat, admin-ordered lists, same shape as PaymentMethodSetting/BankAccountSetting in system-settings.repository.ts. */

// --- /export page's own hero (singleton, id: "global" — same convention as CompanySetting/ExportHeroSetting) ---

export function getPageHeroSetting() {
  return prisma.exportPageHeroSetting.findUnique({ where: { id: "global" } });
}

export function upsertPageHeroSetting(input: Prisma.ExportPageHeroSettingUncheckedCreateInput) {
  return prisma.exportPageHeroSetting.upsert({ where: { id: "global" }, create: { id: "global", ...input }, update: input });
}

// --- Export Solutions cards ---

export function listSolutionCards() {
  return prisma.exportSolutionCard.findMany({ orderBy: { sortOrder: "asc" } });
}

export function findSolutionCardById(id: string) {
  return prisma.exportSolutionCard.findUnique({ where: { id } });
}

export function createSolutionCard(data: Prisma.ExportSolutionCardCreateInput) {
  return prisma.exportSolutionCard.create({ data });
}

export interface UpdateSolutionCardInput {
  visible?: boolean;
  icon?: string;
  title?: string;
  description?: string;
}

export function updateSolutionCard(id: string, input: UpdateSolutionCardInput) {
  return prisma.exportSolutionCard.update({ where: { id }, data: input });
}

export function deleteSolutionCardById(id: string) {
  return prisma.exportSolutionCard.delete({ where: { id } });
}

export function reorderSolutionCards(orderedIds: string[]) {
  return prisma.$transaction(
    orderedIds.map((id, index) => prisma.exportSolutionCard.updateMany({ where: { id }, data: { sortOrder: index } })),
  );
}

export async function nextSolutionCardSortOrder(): Promise<number> {
  const last = await prisma.exportSolutionCard.findFirst({ orderBy: { sortOrder: "desc" } });
  return (last?.sortOrder ?? -1) + 1;
}

// --- Export Process steps ---

export function listProcessSteps() {
  return prisma.exportProcessStep.findMany({ orderBy: { sortOrder: "asc" } });
}

export function findProcessStepById(id: string) {
  return prisma.exportProcessStep.findUnique({ where: { id } });
}

export function createProcessStep(data: Prisma.ExportProcessStepCreateInput) {
  return prisma.exportProcessStep.create({ data });
}

export interface UpdateProcessStepInput {
  visible?: boolean;
  icon?: string;
  title?: string;
  description?: string;
}

export function updateProcessStep(id: string, input: UpdateProcessStepInput) {
  return prisma.exportProcessStep.update({ where: { id }, data: input });
}

export function deleteProcessStepById(id: string) {
  return prisma.exportProcessStep.delete({ where: { id } });
}

export function reorderProcessSteps(orderedIds: string[]) {
  return prisma.$transaction(
    orderedIds.map((id, index) => prisma.exportProcessStep.updateMany({ where: { id }, data: { sortOrder: index } })),
  );
}

export async function nextProcessStepSortOrder(): Promise<number> {
  const last = await prisma.exportProcessStep.findFirst({ orderBy: { sortOrder: "desc" } });
  return (last?.sortOrder ?? -1) + 1;
}
