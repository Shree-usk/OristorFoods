import type { QuestionStatus } from "@/generated/prisma/client";
import * as recipeQaRepository from "@/repositories/recipe-qa.repository";
import { answerRecipeQuestion, canTransitionRecipeQuestion, changeRecipeQuestionStatus } from "@/services/recipe-qa.service";
import { InvalidRecipeQuestionTransitionError, RecipeQuestionNotFoundError } from "@/services/recipe-qa.errors";
import { writeAuditLog } from "@/services/audit-log.service";
import { requirePermission } from "@/services/permission.service";

/**
 * STORY-046.1. The admin-facing Recipe Q&A moderation console. A thin
 * requirePermission + audit-log wrapper around recipe-qa.service.ts's
 * existing canTransitionRecipeQuestion()/answerRecipeQuestion()/
 * changeRecipeQuestionStatus() — mirrors qa-moderation.service.ts
 * (STORY-046) exactly, but as its own, fully separate module: a
 * **separate admin page**, not folded into Product Q&A's console, per
 * this story's explicit "do not merge" instruction.
 *
 * Gates on the existing QA AdminModule (not a new permission system, per
 * spec) — same as Product Q&A. Separation of duties: answer() gates on
 * Edit, approve/reject/publish gate on Approve.
 */

export interface RecipeQaQueueItem {
  id: string;
  submitterName: string;
  submitterEmail: string | null;
  recipeTitle: string;
  recipeHref: string;
  text: string;
  answerText: string | null;
  status: QuestionStatus;
  rejectionReason: string | null;
  createdAt: Date;
}

export interface RecipeQaQueueFilters {
  status?: QuestionStatus;
  recipeId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

function toQueueItem(row: recipeQaRepository.RecipeQuestionAdminRow): RecipeQaQueueItem {
  return {
    id: row.id,
    submitterName: row.customer.name?.trim() || "Oristor customer",
    submitterEmail: row.customer.email,
    recipeTitle: row.recipe.title,
    recipeHref: `/recipes/${row.recipe.slug}`,
    text: row.text,
    answerText: row.answerText,
    status: row.status,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt,
  };
}

export async function listQuestionsForAdmin(
  adminUserId: string,
  filters: RecipeQaQueueFilters,
  page: number,
  pageSize: number,
): Promise<{ items: RecipeQaQueueItem[]; total: number }> {
  await requirePermission(adminUserId, "QA", "View");
  const { items, total } = await recipeQaRepository.listQuestionsForAdmin(filters, page, pageSize);
  return { items: items.map(toQueueItem), total };
}

async function requireRow(id: string) {
  const row = await recipeQaRepository.findQuestionAdminRowById(id);
  if (!row) throw new RecipeQuestionNotFoundError();
  return row;
}

export async function answer(adminUserId: string, id: string, answerText: string): Promise<RecipeQaQueueItem> {
  await requirePermission(adminUserId, "QA", "Edit");
  await requireRow(id);
  await answerRecipeQuestion(id, answerText, adminUserId);
  await writeAuditLog({ actorId: adminUserId, action: "recipe_question_answered", module: "QA", targetType: "RecipeQuestion", targetId: id });
  return toQueueItem(await requireRow(id));
}

export async function approve(adminUserId: string, id: string): Promise<RecipeQaQueueItem> {
  await requirePermission(adminUserId, "QA", "Approve");
  const row = await requireRow(id);
  if (!canTransitionRecipeQuestion(row.status, "Approved")) throw new InvalidRecipeQuestionTransitionError(row.status, "Approved");
  await changeRecipeQuestionStatus(id, "Approved", { approverId: adminUserId });
  await writeAuditLog({ actorId: adminUserId, action: "recipe_question_approved", module: "QA", targetType: "RecipeQuestion", targetId: id, metadata: { from: row.status } });
  return toQueueItem(await requireRow(id));
}

export async function reject(adminUserId: string, id: string, reason: string): Promise<RecipeQaQueueItem> {
  await requirePermission(adminUserId, "QA", "Approve");
  const row = await requireRow(id);
  if (!canTransitionRecipeQuestion(row.status, "Rejected")) throw new InvalidRecipeQuestionTransitionError(row.status, "Rejected");
  await changeRecipeQuestionStatus(id, "Rejected", { rejectionReason: reason });
  await writeAuditLog({ actorId: adminUserId, action: "recipe_question_rejected", module: "QA", targetType: "RecipeQuestion", targetId: id, metadata: { from: row.status, reason } });
  return toQueueItem(await requireRow(id));
}

export async function publish(adminUserId: string, id: string): Promise<RecipeQaQueueItem> {
  await requirePermission(adminUserId, "QA", "Approve");
  const row = await requireRow(id);
  if (!canTransitionRecipeQuestion(row.status, "Published")) throw new InvalidRecipeQuestionTransitionError(row.status, "Published");
  await changeRecipeQuestionStatus(id, "Published");
  await writeAuditLog({ actorId: adminUserId, action: "recipe_question_published", module: "QA", targetType: "RecipeQuestion", targetId: id });
  return toQueueItem(await requireRow(id));
}

export interface BulkRecipeQaModerationResult {
  updated: string[];
  skipped: string[];
}

export async function bulkModerate(adminUserId: string, ids: string[], action: "approve" | "publish"): Promise<BulkRecipeQaModerationResult> {
  await requirePermission(adminUserId, "QA", "Approve");
  const updated: string[] = [];
  const skipped: string[] = [];
  for (const id of ids) {
    try {
      if (action === "approve") await approve(adminUserId, id);
      else await publish(adminUserId, id);
      updated.push(id);
    } catch {
      skipped.push(id);
    }
  }
  return { updated, skipped };
}
