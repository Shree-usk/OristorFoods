import type { QuestionStatus, RecipeQuestion } from "@/generated/prisma/client";
import { findPublishedRecipeBySlug } from "@/repositories/recipe.repository";
import * as recipeQaRepository from "@/repositories/recipe-qa.repository";
import type { RecipeQuestionStatusUpdate } from "@/repositories/recipe-qa.repository";
import { notifyRecipeQuestionPublished } from "@/services/recipe-qa-notifications";
import {
  InvalidRecipeQuestionInputError,
  InvalidRecipeQuestionTransitionError,
  RecipeQaRecipeNotFoundError,
  RecipeQuestionNotFoundError,
} from "@/services/recipe-qa.errors";
import type { PublicRecipeQuestion, RecipeQuestionPage, RecipeQuestionPageQuery } from "@/types/recipe-question";
import { answerTextSchema, recipeQuestionInputSchema, type RecipeQuestionInput } from "@/validation/recipe-question.schema";

/**
 * STORY-046.1. Lightweight, isolated sibling of qa.service.ts (Product
 * Q&A, STORY-016/046) — same submit -> answer -> approve -> publish
 * pipeline, same shape, but never shares code or data with it. Reuses
 * QuestionStatus (the enum) directly since the pipeline is identical, not
 * just similar; see the schema's own comment for why that's not true of
 * ReviewStatus/RecipeReviewStatus.
 */

const allowedTransitions: Record<QuestionStatus, readonly QuestionStatus[]> = {
  Pending: ["Answered", "Rejected"],
  Answered: ["Approved", "Rejected"],
  Approved: ["Published", "Rejected"],
  Published: ["Rejected"],
  Rejected: [],
};

export function canTransitionRecipeQuestion(from: QuestionStatus, to: QuestionStatus): boolean {
  return allowedTransitions[from].includes(to);
}

/**
 * Pending → Answered, recording the staff answer. `moderatorId` is optional
 * only so dev tooling can answer without a staff account; the admin console
 * always passes it.
 */
export async function answerRecipeQuestion(questionId: string, answerText: string, moderatorId?: string) {
  const parsed = answerTextSchema.safeParse(answerText);
  if (!parsed.success) throw new InvalidRecipeQuestionInputError(parsed.error.issues[0]?.message ?? "Invalid answer");

  const question = await recipeQaRepository.findQuestionById(questionId);
  if (!question) throw new RecipeQuestionNotFoundError();
  if (question.status !== "Pending") throw new InvalidRecipeQuestionTransitionError(question.status, "Answered");

  const answered = await recipeQaRepository.answerPendingQuestion(question.id, {
    answerText: parsed.data,
    answeredById: moderatorId ?? null,
    answeredAt: new Date(),
  });
  // Null: it left Pending between the read and the conditional write.
  if (!answered) throw new InvalidRecipeQuestionTransitionError(question.status, "Answered");
  return answered;
}

export interface ChangeRecipeQuestionStatusOptions {
  /** Set on entering Approved. */
  approverId?: string;
  /** Internal-only; set on entering Rejected, never shown to the customer. */
  rejectionReason?: string;
}

/** Approve, publish or reject. Answering goes through answerRecipeQuestion() only. */
export async function changeRecipeQuestionStatus(
  questionId: string,
  nextStatus: QuestionStatus,
  options: ChangeRecipeQuestionStatusOptions = {},
) {
  const question = await recipeQaRepository.findQuestionById(questionId);
  if (!question) throw new RecipeQuestionNotFoundError();
  if (nextStatus === "Answered" || !canTransitionRecipeQuestion(question.status, nextStatus)) {
    throw new InvalidRecipeQuestionTransitionError(question.status, nextStatus);
  }

  const data: RecipeQuestionStatusUpdate = { status: nextStatus };
  if (nextStatus === "Published") data.publishedAt = new Date();
  if (nextStatus === "Approved" && options.approverId) {
    data.approvedById = options.approverId;
    data.approvedAt = new Date();
  }
  if (nextStatus === "Rejected" && options.rejectionReason !== undefined) {
    data.rejectionReason = options.rejectionReason;
  }

  const updated = await recipeQaRepository.updateQuestionStatus(question.id, question.status, data);
  if (!updated) throw new InvalidRecipeQuestionTransitionError(question.status, nextStatus);

  if (nextStatus === "Published") {
    const recipeTitle = await recipeQaRepository.findRecipeTitleById(updated.recipeId);
    await notifyRecipeQuestionPublished({
      questionId: updated.id,
      recipeId: updated.recipeId,
      recipeTitle: recipeTitle ?? "",
      askedByCustomerId: updated.customerId,
      publishedAt: updated.publishedAt ?? new Date(),
    });
  }
  return updated;
}

// ---------------------------------------------------------------------------
// Customer actions and public listing
// ---------------------------------------------------------------------------

function toPublicRecipeQuestion(question: RecipeQuestion): PublicRecipeQuestion {
  return {
    id: question.id,
    question: question.text,
    answer: question.answerText ?? "",
    publishedAt: (question.publishedAt ?? question.updatedAt).toISOString(),
  };
}

async function requirePublishedRecipe(recipeSlug: string) {
  const recipe = await findPublishedRecipeBySlug(recipeSlug);
  if (!recipe) throw new RecipeQaRecipeNotFoundError();
  return recipe;
}

export async function submitRecipeQuestion(customerId: string, recipeSlug: string, input: RecipeQuestionInput): Promise<void> {
  const recipe = await requirePublishedRecipe(recipeSlug);
  // The route validates with the same schema; this protects non-API callers too.
  const parsed = recipeQuestionInputSchema.safeParse(input);
  if (!parsed.success) throw new InvalidRecipeQuestionInputError(parsed.error.issues[0]?.message ?? "Invalid question");

  await recipeQaRepository.createQuestion({ recipeId: recipe.id, customerId, text: parsed.data.text });
}

export async function listPublishedQuestionsForRecipe(recipeId: string, query: RecipeQuestionPageQuery): Promise<RecipeQuestionPage> {
  const { items, total } = await recipeQaRepository.listPublishedQuestions(recipeId, {
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });
  return { items: items.map(toPublicRecipeQuestion), total, page: query.page, pageSize: query.pageSize };
}

export async function listPublishedQuestions(recipeSlug: string, query: RecipeQuestionPageQuery): Promise<RecipeQuestionPage> {
  const recipe = await requirePublishedRecipe(recipeSlug);
  return listPublishedQuestionsForRecipe(recipe.id, query);
}
