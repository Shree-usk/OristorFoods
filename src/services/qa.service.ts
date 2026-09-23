import type { QuestionStatus } from "@/generated/prisma/client";
import { findProductById } from "@/repositories/product.repository";
import * as qaRepository from "@/repositories/qa.repository";
import type { QuestionStatusUpdate } from "@/repositories/qa.repository";
import { notifyQuestionPublished } from "@/services/qa-notifications";
import { InvalidQuestionInputError, InvalidQuestionTransitionError, QuestionNotFoundError } from "@/services/qa.errors";
import { answerTextSchema } from "@/validation/question.schema";

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
