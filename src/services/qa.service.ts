import type { Question, QuestionStatus } from "@/generated/prisma/client";
import { findProductById, findProductBySlug } from "@/repositories/product.repository";
import * as qaRepository from "@/repositories/qa.repository";
import type { QuestionStatusUpdate } from "@/repositories/qa.repository";
import { registerQaSummaryProvider, type QaSummary } from "@/services/product-detail-extensions";
import { notifyQuestionPublished, notifyQuestionSubmitted } from "@/services/qa-notifications";
import {
  InvalidQuestionInputError,
  InvalidQuestionTransitionError,
  QaProductNotFoundError,
  QuestionNotFoundError,
} from "@/services/qa.errors";
import { QUESTION_PAGE_SIZE, type OwnQuestion, type PublicQuestion, type QuestionPage } from "@/types/question";
import {
  answerTextSchema,
  questionInputSchema,
  type QuestionInput,
  type QuestionListQuery,
} from "@/validation/question.schema";

// ---------------------------------------------------------------------------
// Status lifecycle (blueprint Section 7: submit → answer → approve → publish).
// answerQuestion() and changeQuestionStatus() are the only ways a status
// changes; the STORY-046 moderation console calls them.
// ---------------------------------------------------------------------------

const allowedTransitions: Record<QuestionStatus, readonly QuestionStatus[]> = {
  Pending: ["Answered", "Rejected"],
  Answered: ["Approved", "Rejected"],
  Approved: ["Published", "Rejected"],
  Published: ["Rejected"],
  Rejected: [],
};

export function canTransitionQuestion(from: QuestionStatus, to: QuestionStatus): boolean {
  return allowedTransitions[from].includes(to);
}

/**
 * Pending → Answered, recording the staff answer. `moderatorId` is optional
 * only so dev tooling (seed, qa:publish) can answer without a staff account;
 * STORY-046 always passes it.
 */
export async function answerQuestion(questionId: string, answerText: string, moderatorId?: string) {
  const parsed = answerTextSchema.safeParse(answerText);
  if (!parsed.success) throw new InvalidQuestionInputError(parsed.error.issues[0]?.message ?? "Invalid answer");

  const question = await qaRepository.findQuestionById(questionId);
  if (!question) throw new QuestionNotFoundError();
  if (question.status !== "Pending") throw new InvalidQuestionTransitionError(question.status, "Answered");

  const answered = await qaRepository.answerPendingQuestion(question.id, {
    answerText: parsed.data,
    answeredById: moderatorId ?? null,
    answeredAt: new Date(),
  });
  // Null: it left Pending between the read and the conditional write.
  if (!answered) throw new InvalidQuestionTransitionError(question.status, "Answered");
  return answered;
}

/** Approve, publish or reject. Answering goes through answerQuestion() only. */
export async function changeQuestionStatus(questionId: string, nextStatus: QuestionStatus) {
  const question = await qaRepository.findQuestionById(questionId);
  if (!question) throw new QuestionNotFoundError();
  if (nextStatus === "Answered" || !canTransitionQuestion(question.status, nextStatus)) {
    throw new InvalidQuestionTransitionError(question.status, nextStatus);
  }

  const data: QuestionStatusUpdate = { status: nextStatus };
  if (nextStatus === "Published") data.publishedAt = new Date();

  const updated = await qaRepository.updateQuestionStatus(question.id, question.status, data);
  if (!updated) throw new InvalidQuestionTransitionError(question.status, nextStatus);

  if (updated.status === "Published") {
    const product = await findProductById(updated.productId);
    await notifyQuestionPublished({
      questionId: updated.id,
      productId: updated.productId,
      productSlug: product?.slug ?? "",
      productName: product?.name ?? "",
      askedByUserId: updated.userId,
      publishedAt: updated.publishedAt ?? new Date(),
    });
  }
  return updated;
}

// ---------------------------------------------------------------------------
// Customer actions and public listing
// ---------------------------------------------------------------------------

function toOwnQuestion(question: Question): OwnQuestion {
  return { id: question.id, text: question.text, status: question.status, createdAt: question.createdAt.toISOString() };
}

function toPublicQuestion(question: Question): PublicQuestion {
  return {
    id: question.id,
    question: question.text,
    answer: question.answerText ?? "",
    publishedAt: (question.publishedAt ?? question.updatedAt).toISOString(),
  };
}

async function requirePublishedProduct(productSlug: string) {
  const product = await findProductBySlug(productSlug);
  if (!product || product.status !== "Published") throw new QaProductNotFoundError();
  return product;
}

export async function submitQuestion(userId: string, productSlug: string, input: QuestionInput): Promise<OwnQuestion> {
  const product = await requirePublishedProduct(productSlug);
  // Routes validate with the same schema; this protects non-API callers too.
  const parsed = questionInputSchema.safeParse(input);
  if (!parsed.success) throw new InvalidQuestionInputError(parsed.error.issues[0]?.message ?? "Invalid question");

  const question = await qaRepository.createQuestion({ productId: product.id, userId, text: parsed.data.text });
  await notifyQuestionSubmitted({
    questionId: question.id,
    productId: product.id,
    productSlug: product.slug,
    productName: product.name,
    text: question.text,
    askedByUserId: userId,
    submittedAt: question.createdAt,
  });
  return toOwnQuestion(question);
}

export function splitSearchWords(q?: string): string[] {
  return q ? q.trim().split(/\s+/).filter(Boolean) : [];
}

export async function listPublishedQuestionsForProduct(productId: string, query: QuestionListQuery): Promise<QuestionPage> {
  const { items, total } = await qaRepository.listPublishedQuestions(productId, {
    words: splitSearchWords(query.q),
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });
  return { items: items.map(toPublicQuestion), total, page: query.page, pageSize: query.pageSize };
}

export async function listPublishedQuestions(productSlug: string, query: QuestionListQuery): Promise<QuestionPage> {
  const product = await requirePublishedProduct(productSlug);
  return listPublishedQuestionsForProduct(product.id, query);
}

export async function listMyOpenQuestions(userId: string, productSlug: string): Promise<OwnQuestion[]> {
  const product = await requirePublishedProduct(productSlug);
  const questions = await qaRepository.listOpenQuestionsByUser(product.id, userId);
  return questions.map(toOwnQuestion);
}

// ---------------------------------------------------------------------------
// PDP integration (STORY-011 extension point)
// ---------------------------------------------------------------------------

export async function getQaSummaryForProduct(productId: string): Promise<QaSummary | null> {
  const firstPage = await listPublishedQuestionsForProduct(productId, { page: 1, pageSize: QUESTION_PAGE_SIZE });
  if (firstPage.total === 0) return null;
  return { previewItems: firstPage.items, totalCount: firstPage.total };
}

/** Called once at server startup from src/instrumentation.ts. */
export function registerQaProviders(): void {
  registerQaSummaryProvider(getQaSummaryForProduct);
}

// ---------------------------------------------------------------------------
// Dev tooling
// ---------------------------------------------------------------------------

/**
 * Walks a question to Published through the real workflow (answer → approve
 * → publish), so the notify-customer hook fires exactly as in production.
 * For the seed, the qa:publish script and e2e tests only. In production,
 * staff publish from the moderation console (STORY-046).
 */
export async function advanceQuestionToPublished(questionId: string, answerText: string) {
  const question = await qaRepository.findQuestionById(questionId);
  if (!question) throw new QuestionNotFoundError();
  if (question.status === "Published") return question;

  let status: QuestionStatus = question.status;
  if (status === "Pending") status = (await answerQuestion(questionId, answerText)).status;
  if (status === "Answered") status = (await changeQuestionStatus(questionId, "Approved")).status;
  if (status === "Approved") return changeQuestionStatus(questionId, "Published");
  throw new InvalidQuestionTransitionError(status, "Published");
}
