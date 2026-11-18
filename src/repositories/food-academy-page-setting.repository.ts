import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

// Singleton row (id "global"), same shape/intent as export-hero-setting.repository.ts.

export function getFoodAcademyPageSetting() {
  return prisma.foodAcademyPageSetting.findUnique({ where: { id: "global" } });
}

export function upsertFoodAcademyPageSetting(input: Prisma.FoodAcademyPageSettingUncheckedCreateInput) {
  return prisma.foodAcademyPageSetting.upsert({
    where: { id: "global" },
    create: { id: "global", ...input },
    update: input,
  });
}
