import type { PopupInteractionType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-050a. The only place PopupInteraction is queried/mutated — serves both the authenticated frequency-cap check and the performance summary. */

export function createInteraction(popupId: string, userId: string | null, type: PopupInteractionType) {
  return prisma.popupInteraction.create({ data: { popupId, userId, type } });
}

/** The authenticated frequency-cap check — has this customer already seen/dismissed this popup since `since`? */
export function countInteractionsSince(popupId: string, userId: string, type: PopupInteractionType, since: Date) {
  return prisma.popupInteraction.count({ where: { popupId, userId, type, createdAt: { gte: since } } });
}

/** Any interaction ever, for OncePerCustomer / UntilDismissed, which aren't time-windowed. */
export function countInteractionsEver(popupId: string, userId: string, type: PopupInteractionType) {
  return prisma.popupInteraction.count({ where: { popupId, userId, type } });
}

export async function getPerformanceSummary(popupId: string) {
  const rows = await prisma.popupInteraction.groupBy({ by: ["type"], where: { popupId }, _count: { _all: true } });
  const countFor = (type: PopupInteractionType) => rows.find((row) => row.type === type)?._count._all ?? 0;
  return { impressions: countFor("Impression"), clicks: countFor("Click"), dismissals: countFor("Dismissal") };
}
