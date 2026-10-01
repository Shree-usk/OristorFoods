import type { QuestionStatus } from "@/generated/prisma/client";
import * as qaRepository from "@/repositories/qa.repository";
import { answerQuestion, canTransitionQuestion, changeQuestionStatus } from "@/services/qa.service";
import { InvalidQuestionTransitionError, QuestionNotFoundError } from "@/services/qa.errors";
import { writeAuditLog } from "@/services/audit-log.service";
import { requirePermission } from "@/services/permission.service";

/**
 * STORY-046. The admin-facing Q&A moderation console. A thin
 * requirePermission + audit-log wrapper around qa.service.ts's existing
 * canTransitionQuestion()/answerQuestion()/changeQuestionStatus() — no
 * transition logic is reimplemented here, same composition pattern as
 * review-moderation.service.ts (STORY-045).
 *
 * Single-source only: Product Q&A. "Recipe Q&A" in the blueprint's admin
 * console bullet is stale spec drift, confirmed by three independent prior
 * decisions (STORY-022, STORY-039, qa.repository.ts) that it was never
 * built as a storefront feature — see docs/architecture-decisions.md's
 * STORY-046 entry. A separate STORY-047 adds Recipe Q&A as its own,
 * isolated module; it is explicitly out of scope here.
 *
 * Separation of duties (the AC's "answer-authoring staff cannot
 * self-approve") is satisfied by RBAC alone, not a same-user check:
 * answer() gates on QA/Edit, approve/reject/publish gate on QA/Approve —
 * the same Edit-vs-Approve split already used for Recipes (STORY-043) and
 * Reviews (STORY-045). A role granted only Edit can draft answers but
 * cannot call the approve/publish endpoints at all.
 */

export interface QaQueueItem {
  id: string;
  submitterName: string;
  submitterEmail: string | null;
  productName: string;
  productHref: string;
  text: string;
  answerText: string | null;
  status: QuestionStatus;
  rejectionReason: string | null;
  createdAt: Date;
}

export interface QaQueueFilters {
  status?: QuestionStatus;
  productId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

function toQueueItem(row: qaRepository.QuestionAdminRow): QaQueueItem {
  return {
    id: row.id,
    submitterName: row.user.name?.trim() || "Oristor customer",
    submitterEmail: row.user.email,
    productName: row.product.name,
    productHref: `/products/${row.product.slug}`,
    text: row.text,
    answerText: row.answerText,
    status: row.status,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt,
  };
}

export async function listQuestionsForAdmin(
  adminUserId: string,
  filters: QaQueueFilters,
  page: number,
  pageSize: number,
): Promise<{ items: QaQueueItem[]; total: number }> {
  await requirePermission(adminUserId, "QA", "View");
  const { items, total } = await qaRepository.listQuestionsForAdmin(filters, page, pageSize);
  return { items: items.map(toQueueItem), total };
}

async function requireRow(id: string) {
  const row = await qaRepository.findQuestionAdminRowById(id);
  if (!row) throw new QuestionNotFoundError();
  return row;
}

export async function answer(adminUserId: string, id: string, answerText: string): Promise<QaQueueItem> {
  await requirePermission(adminUserId, "QA", "Edit");
  await requireRow(id);
  await answerQuestion(id, answerText, adminUserId);
  await writeAuditLog({ actorId: adminUserId, action: "question_answered", module: "QA", targetType: "Question", targetId: id });
  return toQueueItem(await requireRow(id));
}

export async function approve(adminUserId: string, id: string): Promise<QaQueueItem> {
  await requirePermission(adminUserId, "QA", "Approve");
  const row = await requireRow(id);
  if (!canTransitionQuestion(row.status, "Approved")) throw new InvalidQuestionTransitionError(row.status, "Approved");
  await changeQuestionStatus(id, "Approved", { approverId: adminUserId });
  await writeAuditLog({ actorId: adminUserId, action: "question_approved", module: "QA", targetType: "Question", targetId: id, metadata: { from: row.status } });
  return toQueueItem(await requireRow(id));
}

export async function reject(adminUserId: string, id: string, reason: string): Promise<QaQueueItem> {
  await requirePermission(adminUserId, "QA", "Approve");
  const row = await requireRow(id);
  if (!canTransitionQuestion(row.status, "Rejected")) throw new InvalidQuestionTransitionError(row.status, "Rejected");
  await changeQuestionStatus(id, "Rejected", { rejectionReason: reason });
  await writeAuditLog({ actorId: adminUserId, action: "question_rejected", module: "QA", targetType: "Question", targetId: id, metadata: { from: row.status, reason } });
  return toQueueItem(await requireRow(id));
}

export async function publish(adminUserId: string, id: string): Promise<QaQueueItem> {
  await requirePermission(adminUserId, "QA", "Approve");
  const row = await requireRow(id);
  if (!canTransitionQuestion(row.status, "Published")) throw new InvalidQuestionTransitionError(row.status, "Published");
  await changeQuestionStatus(id, "Published");
  await writeAuditLog({ actorId: adminUserId, action: "question_published", module: "QA", targetType: "Question", targetId: id });
  return toQueueItem(await requireRow(id));
}

export interface BulkQaModerationResult {
  updated: string[];
  skipped: string[];
}

export async function bulkModerate(adminUserId: string, ids: string[], action: "approve" | "publish"): Promise<BulkQaModerationResult> {
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
