import type { FoodAcademyContentType, FoodAcademyEntryStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { escapeLikePattern } from "@/lib/escape-like-pattern";

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
    // Admin-curated order (Food Academy CMS), not recency — see
    // FoodAcademyEntry.sortOrder's schema comment.
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
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

// STORY-061. By id (any status, unlike every other read here) — the
// one lookup embedding.service.ts needs for its best-effort refresh,
// which must see `status` to skip a non-Published entry. A dedicated
// select, not a reuse of foodAcademyEntryCardSelect (which omits
// status — it's a public-facing card shape).
const foodAcademyEntryEmbeddingSelect = {
  id: true,
  title: true,
  summary: true,
  status: true,
} satisfies Prisma.FoodAcademyEntrySelect;

export function findFoodAcademyEntryById(id: string) {
  return prisma.foodAcademyEntry.findUnique({ where: { id }, select: foodAcademyEntryEmbeddingSelect });
}

export async function findRelatedFoodAcademyEntries(
  entry: { id: string; categoryId: string },
  limit: number,
): Promise<FoodAcademyEntryCardRow[]> {
  const sameCategory = await prisma.foodAcademyEntry.findMany({
    where: { status: "Published", id: { not: entry.id }, categoryId: entry.categoryId },
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
    take: limit,
    select: foodAcademyEntryCardSelect,
  });
  if (sameCategory.length >= limit) return sameCategory;

  // Top up with other recent Published entries so an entry in a category
  // with no other Published siblings still gets a related/next
  // recommendation, per the acceptance criterion.
  const fallback = await prisma.foodAcademyEntry.findMany({
    where: {
      status: "Published",
      id: { notIn: [entry.id, ...sameCategory.map((e) => e.id)] },
    },
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
    take: limit - sameCategory.length,
    select: foodAcademyEntryCardSelect,
  });
  return [...sameCategory, ...fallback];
}

export function findActiveFoodAcademyCategories(): Promise<{ id: string; name: string; slug: string; description: string | null; tileImageUrl: string | null; tileImageAlt: string | null }[]> {
  return prisma.foodAcademyCategory.findMany({
    where: { status: "Active", entries: { some: { status: "Published" } } },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, name: true, slug: true, description: true, tileImageUrl: true, tileImageAlt: true },
  });
}

export function createFoodAcademyEntry(data: Prisma.FoodAcademyEntryUncheckedCreateInput) {
  return prisma.foodAcademyEntry.create({ data });
}

// --- Admin (categories) ---
// No admin authoring UI existed for Food Academy before this — content
// previously arrived only via prisma/seed-food-academy.ts. These functions
// are the first write paths beyond that seed script.

const foodAcademyCategoryAdminSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  tileImageUrl: true,
  tileImageAlt: true,
  sortOrder: true,
  status: true,
  _count: { select: { entries: true } },
} satisfies Prisma.FoodAcademyCategorySelect;

export type FoodAcademyCategoryAdminRow = Prisma.FoodAcademyCategoryGetPayload<{ select: typeof foodAcademyCategoryAdminSelect }>;

export function listAllFoodAcademyCategoriesForAdmin(): Promise<FoodAcademyCategoryAdminRow[]> {
  return prisma.foodAcademyCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: foodAcademyCategoryAdminSelect,
  });
}

export function findFoodAcademyCategoryByIdForAdmin(id: string): Promise<FoodAcademyCategoryAdminRow | null> {
  return prisma.foodAcademyCategory.findUnique({ where: { id }, select: foodAcademyCategoryAdminSelect });
}

export interface FoodAcademyCategoryAdminWriteInput {
  name: string;
  slug: string;
  description?: string | null;
  tileImageUrl?: string | null;
  tileImageAlt?: string | null;
  status?: "Active" | "Inactive";
}

export async function createFoodAcademyCategoryAdmin(input: FoodAcademyCategoryAdminWriteInput): Promise<FoodAcademyCategoryAdminRow> {
  const last = await prisma.foodAcademyCategory.findFirst({ orderBy: { sortOrder: "desc" } });
  return prisma.foodAcademyCategory.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      tileImageUrl: input.tileImageUrl ?? null,
      tileImageAlt: input.tileImageAlt ?? null,
      status: input.status ?? "Active",
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
    select: foodAcademyCategoryAdminSelect,
  });
}

export function updateFoodAcademyCategoryAdmin(id: string, input: FoodAcademyCategoryAdminWriteInput): Promise<FoodAcademyCategoryAdminRow> {
  return prisma.foodAcademyCategory.update({
    where: { id },
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      tileImageUrl: input.tileImageUrl ?? null,
      tileImageAlt: input.tileImageAlt ?? null,
      status: input.status ?? "Active",
    },
    select: foodAcademyCategoryAdminSelect,
  });
}

export function deleteFoodAcademyCategoryById(id: string): Promise<unknown> {
  return prisma.foodAcademyCategory.delete({ where: { id } });
}

export function reorderFoodAcademyCategories(orderedIds: string[]) {
  return prisma.$transaction(orderedIds.map((id, index) => prisma.foodAcademyCategory.updateMany({ where: { id }, data: { sortOrder: index } })));
}

// --- Admin (entries) ---

const foodAcademyEntryAdminDetailSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  heroImageUrl: true,
  contentType: true,
  categoryId: true,
  category: { select: { id: true, name: true } },
  bodyContent: true,
  readingTimeMinutes: true,
  authorName: true,
  isFeatured: true,
  sortOrder: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  sections: {
    select: { id: true, sectionNumber: true, title: true, bodyContent: true, imageUrl: true },
    orderBy: { sectionNumber: "asc" },
  },
  recipeRefs: { select: { recipeId: true } },
  productRefs: { select: { productId: true } },
} satisfies Prisma.FoodAcademyEntrySelect;

export type FoodAcademyEntryAdminDetail = Prisma.FoodAcademyEntryGetPayload<{ select: typeof foodAcademyEntryAdminDetailSelect }>;

export function findFoodAcademyEntryAdminDetailById(id: string): Promise<FoodAcademyEntryAdminDetail | null> {
  return prisma.foodAcademyEntry.findUnique({ where: { id }, select: foodAcademyEntryAdminDetailSelect });
}

export function findFoodAcademyEntryBySlugForAdmin(slug: string) {
  return prisma.foodAcademyEntry.findUnique({ where: { slug }, select: { id: true } });
}

const foodAcademyEntryAdminListSelect = {
  id: true,
  slug: true,
  title: true,
  status: true,
  contentType: true,
  isFeatured: true,
  sortOrder: true,
  category: { select: { name: true } },
  updatedAt: true,
} satisfies Prisma.FoodAcademyEntrySelect;

export type FoodAcademyEntryAdminListRow = Prisma.FoodAcademyEntryGetPayload<{ select: typeof foodAcademyEntryAdminListSelect }>;

export interface FoodAcademyEntryAdminListFilters {
  status?: FoodAcademyEntryStatus;
  categoryId?: string;
  search?: string;
}

export async function listFoodAcademyEntriesForAdmin(
  filters: FoodAcademyEntryAdminListFilters,
  page: number,
  pageSize: number,
): Promise<{ items: FoodAcademyEntryAdminListRow[]; total: number }> {
  const where: Prisma.FoodAcademyEntryWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.search ? { title: { contains: escapeLikePattern(filters.search), mode: "insensitive" as const } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.foodAcademyEntry.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize, select: foodAcademyEntryAdminListSelect }),
    prisma.foodAcademyEntry.count({ where }),
  ]);
  return { items, total };
}

/** Ids of every currently-featured entry, any status — used to validate a reorder request's id list, not for display. */
export async function listFeaturedFoodAcademyEntryIdsForAdmin(): Promise<string[]> {
  const rows = await prisma.foodAcademyEntry.findMany({ where: { isFeatured: true }, select: { id: true } });
  return rows.map((row) => row.id);
}

export interface FoodAcademyEntrySectionInput {
  sectionNumber: number;
  title: string;
  bodyContent: string;
  imageUrl?: string | null;
}

export interface FoodAcademyEntryAdminWriteInput {
  slug: string;
  title: string;
  summary: string;
  heroImageUrl?: string | null;
  contentType: FoodAcademyContentType;
  categoryId: string;
  bodyContent?: string | null;
  readingTimeMinutes?: number | null;
  authorName?: string | null;
  isFeatured: boolean;
  sections: FoodAcademyEntrySectionInput[];
  recipeIds: string[];
  productIds: string[];
}

function sectionsCreate(sections: FoodAcademyEntrySectionInput[]) {
  return sections.map((section) => ({
    sectionNumber: section.sectionNumber,
    title: section.title,
    bodyContent: section.bodyContent,
    imageUrl: section.imageUrl ?? null,
  }));
}

export async function createFoodAcademyEntryAdmin(input: FoodAcademyEntryAdminWriteInput): Promise<FoodAcademyEntryAdminDetail> {
  return prisma.foodAcademyEntry.create({
    data: {
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      heroImageUrl: input.heroImageUrl ?? null,
      contentType: input.contentType,
      categoryId: input.categoryId,
      bodyContent: input.bodyContent ?? null,
      readingTimeMinutes: input.readingTimeMinutes ?? null,
      authorName: input.authorName ?? null,
      isFeatured: input.isFeatured,
      sections: input.sections.length ? { create: sectionsCreate(input.sections) } : undefined,
      recipeRefs: input.recipeIds.length ? { create: input.recipeIds.map((recipeId) => ({ recipeId })) } : undefined,
      productRefs: input.productIds.length ? { create: input.productIds.map((productId) => ({ productId })) } : undefined,
    },
    select: foodAcademyEntryAdminDetailSelect,
  });
}

/** Sections/recipeRefs/productRefs are always replace-all on update — the editor always submits the full current list, never a partial patch, matching recipe.repository.ts::updateRecipeAdmin's ingredients/steps precedent. */
export function updateFoodAcademyEntryAdmin(id: string, input: FoodAcademyEntryAdminWriteInput): Promise<FoodAcademyEntryAdminDetail> {
  return prisma.foodAcademyEntry.update({
    where: { id },
    data: {
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      heroImageUrl: input.heroImageUrl ?? null,
      contentType: input.contentType,
      categoryId: input.categoryId,
      bodyContent: input.bodyContent ?? null,
      readingTimeMinutes: input.readingTimeMinutes ?? null,
      authorName: input.authorName ?? null,
      isFeatured: input.isFeatured,
      sections: { deleteMany: {}, create: sectionsCreate(input.sections) },
      recipeRefs: { deleteMany: {}, create: input.recipeIds.map((recipeId) => ({ recipeId })) },
      productRefs: { deleteMany: {}, create: input.productIds.map((productId) => ({ productId })) },
    },
    select: foodAcademyEntryAdminDetailSelect,
  });
}

export function deleteFoodAcademyEntryById(id: string): Promise<unknown> {
  return prisma.foodAcademyEntry.delete({ where: { id } });
}

export function updateFoodAcademyEntryStatus(id: string, data: { status: FoodAcademyEntryStatus; publishedAt: Date | null }): Promise<FoodAcademyEntryAdminDetail> {
  return prisma.foodAcademyEntry.update({ where: { id }, data, select: foodAcademyEntryAdminDetailSelect });
}

export function toggleFoodAcademyEntryFeatured(id: string, isFeatured: boolean): Promise<FoodAcademyEntryAdminDetail> {
  return prisma.foodAcademyEntry.update({ where: { id }, data: { isFeatured }, select: foodAcademyEntryAdminDetailSelect });
}

/** Scoped to isFeatured entries by the where clause too, as defense-in-depth alongside the service-layer check that every id passed in is currently featured. */
export function reorderFoodAcademyEntries(orderedIds: string[]) {
  return prisma.$transaction(orderedIds.map((id, index) => prisma.foodAcademyEntry.updateMany({ where: { id, isFeatured: true }, data: { sortOrder: index } })));
}
