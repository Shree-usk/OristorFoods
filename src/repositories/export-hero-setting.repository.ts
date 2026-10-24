import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** Singleton row upserted by id: "global" — same pattern as CompanySetting/ExportCatalogueSetting (system-settings.repository.ts / export-catalogue-setting.repository.ts). */

export function getExportHeroSetting() {
  return prisma.exportHeroSetting.findUnique({ where: { id: "global" } });
}

export function upsertExportHeroSetting(input: Prisma.ExportHeroSettingUncheckedCreateInput) {
  return prisma.exportHeroSetting.upsert({ where: { id: "global" }, create: { id: "global", ...input }, update: input });
}
