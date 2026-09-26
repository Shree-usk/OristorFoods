import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export const foodAcademyEntryCardSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  heroImageUrl: true,
  contentType: true,
  readingTimeMinutes: true,
  isFeatured: true,
  category: { select: { name: true, slug: true } },
} satisfies Prisma.FoodAcademyEntrySelect;

export type FoodAcademyEntryCardRow = Prisma.FoodAcademyEntryGetPayload<{ select: typeof foodAcademyEntryCardSelect }>;

export async function findPublishedFoodAcademyEntries(args: {
  where: Prisma.FoodAcademyEntryWhereInput;
  skip: number;
  take: number;
}): Promise<{ rows: FoodAcademyEntryCardRow[]; total: number }> {
  // Strip any caller-supplied `status` before composing: AND-ing a
  // conflicting status in would silently zero out results, and merging it
  // via spread would let a caller widen the Published-only invariant.
  const { status: _callerStatus, ...restWhere } = args.where;
  const where: Prisma.FoodAcademyEntryWhereInput = { AND: [{ status: "Published" }, restWhere] };
  const [rows, total] = await prisma.$transaction([
    prisma.foodAcademyEntry.findMany({
      where,
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
      skip: args.skip,
      take: args.take,
      select: foodAcademyEntryCardSelect,
    }),
    prisma.foodAcademyEntry.count({ where }),
  ]);
  return { rows, total };
}

export function findFeaturedFoodAcademyEntries(limit: number): Promise<FoodAcademyEntryCardRow[]> {
  return prisma.foodAcademyEntry.findMany({
    where: { status: "Published", isFeatured: true },
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
    take: limit,
    select: foodAcademyEntryCardSelect,
  });
}

export const foodAcademyEntryDetailSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  heroImageUrl: true,
  contentType: true,
  readingTimeMinutes: true,
  isFeatured: true,
  bodyContent: true,
  authorName: true,
  categoryId: true,
  category: { select: { name: true, slug: true } },
  sections: {
    select: { id: true, sectionNumber: true, title: true, bodyContent: true, imageUrl: true },
    orderBy: { sectionNumber: "asc" },
  },
  // Raw ids only — Task 5 resolves these through recipe.service.ts's
  // getRecipesByIds and product.service.ts's getProductsByIds, both of
  // which already enforce Published-only. Do not join Recipe/Product
  // fields here; that would be a second place deciding what those cards
  // look like.
  recipeRefs: { select: { recipeId: true } },
  productRefs: { select: { productId: true } },
} satisfies Prisma.FoodAcademyEntrySelect;

export type FoodAcademyEntryDetailRow = Prisma.FoodAcademyEntryGetPayload<{ select: typeof foodAcademyEntryDetailSelect }>;

export function findPublishedFoodAcademyEntryBySlug(slug: string): Promise<FoodAcademyEntryDetailRow | null> {
  return prisma.foodAcademyEntry.findFirst({
    where: { slug, status: "Published" },
    select: foodAcademyEntryDetailSelect,
  });
}

export function findRelatedFoodAcademyEntries(
  entry: { id: string; categoryId: string },
  limit: number,
): Promise<FoodAcademyEntryCardRow[]> {
  return prisma.foodAcademyEntry.findMany({
    where: { status: "Published", id: { not: entry.id }, categoryId: entry.categoryId },
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
    take: limit,
    select: foodAcademyEntryCardSelect,
  });
}

export function findActiveFoodAcademyCategories(): Promise<{ id: string; name: string; slug: string }[]> {
  return prisma.foodAcademyCategory.findMany({
    where: { status: "Active" },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, name: true, slug: true },
  });
}

export function createFoodAcademyEntry(data: Prisma.FoodAcademyEntryUncheckedCreateInput) {
  return prisma.foodAcademyEntry.create({ data });
}
