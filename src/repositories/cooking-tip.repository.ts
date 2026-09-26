import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export const cookingTipCardSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  imageUrl: true,
  videoUrl: true,
  videoProvider: true,
  topicTag: true,
} satisfies Prisma.CookingTipSelect;

export type CookingTipCardRow = Prisma.CookingTipGetPayload<{ select: typeof cookingTipCardSelect }>;

export async function findPublishedCookingTips(args: {
  where: Prisma.CookingTipWhereInput;
  skip: number;
  take: number;
}): Promise<{ rows: CookingTipCardRow[]; total: number }> {
  // Strip any caller-supplied `status` before composing: AND-ing a conflicting
  // status in would silently zero out results, and merging it in via spread
  // would let a caller widen the Published-only invariant. Composing via AND
  // (rather than a same-key object spread) matches the pattern established in
  // recipe.repository.ts's buildRecipeWhere.
  const { status: _callerStatus, ...restWhere } = args.where;
  const where: Prisma.CookingTipWhereInput = { AND: [{ status: "Published" }, restWhere] };
  const [rows, total] = await prisma.$transaction([
    prisma.cookingTip.findMany({
      where,
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
      skip: args.skip,
      take: args.take,
      select: cookingTipCardSelect,
    }),
    prisma.cookingTip.count({ where }),
  ]);
  return { rows, total };
}

export const cookingTipDetailSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  bodyContent: true,
  imageUrl: true,
  videoUrl: true,
  videoProvider: true,
  topicTag: true,
  productRefs: {
    where: { product: { status: "Published" } },
    select: { product: { select: { id: true, slug: true, name: true } } },
  },
} satisfies Prisma.CookingTipSelect;

export type CookingTipDetailRow = Prisma.CookingTipGetPayload<{ select: typeof cookingTipDetailSelect }>;

export function findPublishedCookingTipBySlug(slug: string): Promise<CookingTipDetailRow | null> {
  return prisma.cookingTip.findFirst({
    where: { slug, status: "Published" },
    select: cookingTipDetailSelect,
  });
}

export function findRelatedCookingTips(
  tip: { id: string; topicTag: string },
  limit: number,
): Promise<CookingTipCardRow[]> {
  return prisma.cookingTip.findMany({
    where: { status: "Published", id: { not: tip.id }, topicTag: tip.topicTag },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take: limit,
    select: cookingTipCardSelect,
  });
}

export function findActiveTopicTagsWithPublishedTips(): Promise<{ tag: string }[]> {
  return prisma.cookingTip
    .findMany({
      where: { status: "Published" },
      select: { topicTag: true },
      distinct: ["topicTag"],
      orderBy: { topicTag: "asc" },
    })
    .then((rows) => rows.map((row) => ({ tag: row.topicTag })));
}

export function createCookingTip(data: Prisma.CookingTipUncheckedCreateInput) {
  return prisma.cookingTip.create({ data });
}
