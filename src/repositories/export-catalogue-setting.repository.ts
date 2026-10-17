import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** Singleton row upserted by id: "global" — same pattern as CompanySetting/TaxSetting (system-settings.repository.ts). */

export function getExportCatalogueSetting() {
  return prisma.exportCatalogueSetting.findUnique({ where: { id: "global" } });
}

export function upsertExportCatalogueSetting(input: Prisma.ExportCatalogueSettingUncheckedCreateInput) {
  return prisma.exportCatalogueSetting.upsert({ where: { id: "global" }, create: { id: "global", ...input }, update: input });
}
