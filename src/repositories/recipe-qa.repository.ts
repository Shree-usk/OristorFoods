import type { Prisma, QuestionStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * STORY-046.1. Mirrors qa.repository.ts (Product Q&A, STORY-016/046)
 * closely, with two deliberate omissions for this story's lightweight
 * scope: no listOpenQuestionsByUser ("my open questions" tracking) and
 * no text search on the customer-facing list — neither was asked for.
 */

export interface PublishedRecipeQuestionQuery {
  skip: number;
  take: number;
}

export interface RecipeQuestionStatusUpdate {
  status: QuestionStatus;
  publishedAt?: Date;
  approvedById?: string;
  approvedAt?: Date;
  rejectionReason?: string;
}

export function createQuestion(data: { recipeId: string; customerId: string; text: string }) {
  return prisma.recipeQuestion.create({ data });
}

/** Just the title, for the publish notification — lighter than recipe.repository.ts's admin-detail lookups. */
export async function findRecipeTitleById(recipeId: string): Promise<string | null> {
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId }, select: { title: true } });
  return recipe?.title ?? null;
}

export function findQuestionById(id: string) {
  return prisma.recipeQuestion.findUnique({ where: { id } });
}

export async function listPublishedQuestions(recipeId: string, query: PublishedRecipeQuestionQuery) {
  const where: Prisma.RecipeQuestionWhereInput = { recipeId, status: "Published" };
  const [items, total] = await Promise.all([
    prisma.recipeQuestion.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      skip: query.skip,
      take: query.take,
    }),
    prisma.recipeQuestion.count({ where }),
  ]);
  return { items, total };
}

/**
 * Pending → Answered, conditional on the question still being Pending (so a
 * concurrent reject can't be overwritten). Returns null when nothing matched.
 */
export async function answerPendingQuestion(
  id: string,
  data: { answerText: string; answeredById: string | null; answeredAt: Date },
) {
  const { count } = await prisma.recipeQuestion.updateMany({
    where: { id, status: "Pending" },
    data: { ...data, status: "Answered" },
  });
  return count === 0 ? null : prisma.recipeQuestion.findUnique({ where: { id } });
}

/** Conditional on the status the caller read; returns null when it changed meanwhile. */
export async function updateQuestionStatus(id: string, fromStatus: QuestionStatus, data: RecipeQuestionStatusUpdate) {
  const { count } = await prisma.recipeQuestion.updateMany({ where: { id, status: fromStatus }, data });
  return count === 0 ? null : prisma.recipeQuestion.findUnique({ where: { id } });
}

// ---------------------------------------------------------------------------
// Admin moderation queue.
// ---------------------------------------------------------------------------

const recipeQuestionAdminSelect = {
  id: true,
  recipeId: true,
  customerId: true,
  text: true,
  status: true,
  answerText: true,
  answeredById: true,
  answeredAt: true,
  approvedById: true,
  approvedAt: true,
  rejectionReason: true,
  publishedAt: true,
  createdAt: true,
  customer: { select: { name: true, email: true } },
  recipe: { select: { id: true, slug: true, title: true } },
} satisfies Prisma.RecipeQuestionSelect;

export type RecipeQuestionAdminRow = Prisma.RecipeQuestionGetPayload<{ select: typeof recipeQuestionAdminSelect }>;

export interface RecipeQuestionAdminListFilters {
  status?: QuestionStatus;
  recipeId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export async function listQuestionsForAdmin(
  filters: RecipeQuestionAdminListFilters,
  page: number,
  pageSize: number,
): Promise<{ items: RecipeQuestionAdminRow[]; total: number }> {
  const where: Prisma.RecipeQuestionWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.recipeId ? { recipeId: filters.recipeId } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? { createdAt: { ...(filters.dateFrom ? { gte: filters.dateFrom } : {}), ...(filters.dateTo ? { lte: filters.dateTo } : {}) } }
      : {}),
    ...(filters.search
      ? {
          OR: [
            { text: { contains: filters.search, mode: "insensitive" as const } },
            { answerText: { contains: filters.search, mode: "insensitive" as const } },
            // Doubles as the "Recipe filter" from the spec — no separate
            // recipe picker; searching a recipe's title finds its questions.
            { recipe: { title: { contains: filters.search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.recipeQuestion.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: recipeQuestionAdminSelect,
    }),
    prisma.recipeQuestion.count({ where }),
  ]);
  return { items, total };
}

export function findQuestionAdminRowById(id: string): Promise<RecipeQuestionAdminRow | null> {
  return prisma.recipeQuestion.findUnique({ where: { id }, select: recipeQuestionAdminSelect });
}
