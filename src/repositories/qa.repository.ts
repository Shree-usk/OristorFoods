import type { Prisma, QuestionStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export interface PublishedQuestionQuery {
  /** Every word must match the question text or answer text (case-insensitive). */
  words: string[];
  skip: number;
  take: number;
}

export interface QuestionStatusUpdate {
  status: QuestionStatus;
  publishedAt?: Date;
}

const openStatuses: QuestionStatus[] = ["Pending", "Answered", "Approved"];

export function createQuestion(data: { productId: string; userId: string; text: string }) {
  return prisma.question.create({ data });
}

export function findQuestionById(id: string) {
  return prisma.question.findUnique({ where: { id } });
}

function publishedWhere(productId: string, words: string[]): Prisma.QuestionWhereInput {
  return {
    productId,
    status: "Published",
    AND: words.map((word) => ({
      OR: [
        { text: { contains: word, mode: "insensitive" } },
        { answerText: { contains: word, mode: "insensitive" } },
      ],
    })),
  };
}

export async function listPublishedQuestions(productId: string, query: PublishedQuestionQuery) {
  const where = publishedWhere(productId, query.words);
  const [items, total] = await Promise.all([
    prisma.question.findMany({
      where,
      // id breaks ties so pagination never repeats or skips a question.
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      skip: query.skip,
      take: query.take,
    }),
    prisma.question.count({ where }),
  ]);
  return { items, total };
}

export function listOpenQuestionsByUser(productId: string, userId: string) {
  return prisma.question.findMany({
    where: { productId, userId, status: { in: openStatuses } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
}

/**
 * Pending → Answered, conditional on the question still being Pending (so a
 * concurrent reject can't be overwritten). Returns null when nothing matched.
 */
export async function answerPendingQuestion(
  id: string,
  data: { answerText: string; answeredById: string | null; answeredAt: Date },
) {
  const { count } = await prisma.question.updateMany({
    where: { id, status: "Pending" },
    data: { ...data, status: "Answered" },
  });
  return count === 0 ? null : prisma.question.findUnique({ where: { id } });
}

/** Conditional on the status the caller read; returns null when it changed meanwhile. */
export async function updateQuestionStatus(id: string, fromStatus: QuestionStatus, data: QuestionStatusUpdate) {
  const { count } = await prisma.question.updateMany({ where: { id, status: fromStatus }, data });
  return count === 0 ? null : prisma.question.findUnique({ where: { id } });
}
