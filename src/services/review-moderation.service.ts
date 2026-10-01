import type { BlogCommentStatus, RecipeReviewStatus, ReviewStatus } from "@/generated/prisma/client";
import * as reviewRepository from "@/repositories/review.repository";
import * as recipeReviewRepository from "@/repositories/recipe-review.repository";
import * as blogRepository from "@/repositories/blog.repository";
import { canTransitionReview, changeReviewStatus, setAdminReply as setReviewAdminReply, setFeatured as setReviewFeatured } from "@/services/review.service";
import { canTransitionRecipeReview, changeRecipeReviewStatus, setAdminReply as setRecipeReviewAdminReply, setFeatured as setRecipeReviewFeatured } from "@/services/recipe-review.service";
import { canTransitionComment, changeCommentStatus, setCommentAdminReply } from "@/services/blog.service";
import { grantManualPoints } from "@/services/rewards.service";
import { sendNotification } from "@/services/notification.service";
import { writeAuditLog } from "@/services/audit-log.service";
import { requirePermission } from "@/services/permission.service";
import {
  ReviewModerationFeatureNotSupportedError,
  ReviewModerationIllegalTransitionError,
  ReviewModerationNotFoundError,
  ReviewModerationRewardTargetInvalidError,
} from "@/services/review-moderation.errors";

/**
 * STORY-045. Unifies moderation for the three already-shipped submission
 * flows (STORY-015 product reviews, STORY-022 recipe reviews, STORY-021/044
 * blog comments) behind one console. Every one of their own transition
 * services already has a comment saying "approved from the moderation
 * console (Epic 07, STORY-045)" — this file is that console's backend,
 * composing the existing canTransition.../change...Status functions
 * rather than reimplementing any transition logic.
 *
 * The three lifecycles are NOT symmetric and this file doesn't pretend
 * they are:
 *   - product (Review): Pending -> Approved -> Published -> Archived, with
 *     Published <-> Hidden also possible. Approved is NOT yet publicly
 *     visible — Published is. Only this source has publish/archive/restore.
 *   - recipe (RecipeReview) and blog-comment (BlogComment): Pending ->
 *     Approved -> Hidden. Approved IS the publicly visible state already —
 *     no separate publish step, and Hidden is terminal (no restore) in
 *     their own already-shipped STORY-021/022 design, which this story
 *     does not reopen.
 * Approve/Reject/Hide are offered uniformly (each domain's own
 * canTransition check is still the real authority); Publish/Archive/
 * Restore are product-only.
 *
 * Permission note: blog-comment moderation taken THROUGH THIS CONSOLE gates
 * on the "Reviews" module, not "Blog" — deliberately distinct from
 * STORY-044's own admin-blog-comments-view.tsx, which gates on "Blog".
 * Customer Support (the AC's named persona for this console) has "Reviews"
 * as a home module but only View on "Blog" by STORY-038's seed matrix; the
 * unified console would be useless to that persona for its one stated
 * purpose if it gated blog-comment actions on a module that role doesn't
 * have. Both are valid, independent entry points to the same underlying
 * blog.service.ts transition functions — "two doors, one lock."
 */

export type ModerationSourceType = "product" | "recipe" | "blog-comment";

export interface ModerationQueueItem {
  sourceType: ModerationSourceType;
  id: string;
  submitterName: string;
  submitterEmail: string | null;
  targetName: string;
  targetHref: string;
  rating: number | null;
  body: string;
  status: string;
  featured: boolean | null;
  adminReplyBody: string | null;
  createdAt: Date;
}

export interface ModerationQueueFilters {
  sourceType?: ModerationSourceType;
  status?: string;
  rating?: number;
  search?: string;
}

const REVIEW_STATUSES: readonly string[] = ["Pending", "Approved", "Published", "Rejected", "Archived", "Hidden"];
const RECIPE_REVIEW_STATUSES: readonly string[] = ["Pending", "Approved", "Rejected", "Hidden"];
const BLOG_COMMENT_STATUSES: readonly string[] = ["Pending", "Approved", "Rejected", "Hidden"];

function toReviewItem(row: reviewRepository.ReviewAdminRow): ModerationQueueItem {
  return {
    sourceType: "product",
    id: row.id,
    submitterName: row.user.name?.trim() || "Oristor customer",
    submitterEmail: row.user.email,
    targetName: row.product.name,
    targetHref: `/products/${row.product.slug}`,
    rating: row.rating,
    body: row.body,
    status: row.status,
    featured: row.featured,
    adminReplyBody: row.adminReplyBody,
    createdAt: row.createdAt,
  };
}

function toRecipeReviewItem(row: recipeReviewRepository.RecipeReviewAdminRow): ModerationQueueItem {
  return {
    sourceType: "recipe",
    id: row.id,
    submitterName: row.customer.name?.trim() || "Oristor customer",
    submitterEmail: row.customer.email,
    targetName: row.recipe.title,
    targetHref: `/recipes/${row.recipe.slug}`,
    rating: row.rating,
    body: row.reviewText ?? "",
    status: row.status,
    featured: row.featured,
    adminReplyBody: row.adminReplyBody,
    createdAt: row.createdAt,
  };
}

function toBlogCommentItem(row: blogRepository.BlogCommentAdminListRow): ModerationQueueItem {
  return {
    sourceType: "blog-comment",
    id: row.id,
    submitterName: row.authorName,
    submitterEmail: row.authorEmail,
    targetName: row.post.title,
    targetHref: `/blog/${row.post.slug}`,
    rating: null,
    body: row.body,
    status: row.status,
    featured: null,
    adminReplyBody: row.adminReplyBody,
    createdAt: row.createdAt,
  };
}

export async function listModerationQueue(adminUserId: string, filters: ModerationQueueFilters, page: number, pageSize: number): Promise<{ items: ModerationQueueItem[]; total: number }> {
  await requirePermission(adminUserId, "Reviews", "View");

  if (filters.sourceType === "product") {
    const status = filters.status && REVIEW_STATUSES.includes(filters.status) ? (filters.status as ReviewStatus) : undefined;
    if (filters.status && !status) return { items: [], total: 0 };
    const { items, total } = await reviewRepository.listReviewsForAdmin({ status, rating: filters.rating, search: filters.search }, page, pageSize);
    return { items: items.map(toReviewItem), total };
  }
  if (filters.sourceType === "recipe") {
    const status = filters.status && RECIPE_REVIEW_STATUSES.includes(filters.status) ? (filters.status as RecipeReviewStatus) : undefined;
    if (filters.status && !status) return { items: [], total: 0 };
    const { items, total } = await recipeReviewRepository.listRecipeReviewsForAdmin({ status, rating: filters.rating, search: filters.search }, page, pageSize);
    return { items: items.map(toRecipeReviewItem), total };
  }
  if (filters.sourceType === "blog-comment") {
    const status = filters.status && BLOG_COMMENT_STATUSES.includes(filters.status) ? (filters.status as BlogCommentStatus) : undefined;
    if (filters.status && !status) return { items: [], total: 0 };
    const { items, total } = await blogRepository.listCommentsForAdmin({ status, search: filters.search }, page, pageSize);
    return { items: items.map(toBlogCommentItem), total };
  }

  // "All": a bounded merge, not true cross-source pagination — see
  // docs/architecture-decisions.md's STORY-045 entry. Each domain is
  // queried for the first `page * pageSize` rows (capped), merged, sorted
  // by createdAt desc, then sliced to this page's window. A status filter
  // invalid for a given domain excludes that domain's rows entirely
  // (never silently shows them unfiltered).
  const depth = Math.min(page * pageSize, 500);
  const reviewStatus = !filters.status ? undefined : REVIEW_STATUSES.includes(filters.status) ? (filters.status as ReviewStatus) : "__none__";
  const recipeStatus = !filters.status ? undefined : RECIPE_REVIEW_STATUSES.includes(filters.status) ? (filters.status as RecipeReviewStatus) : "__none__";
  const blogStatus = !filters.status ? undefined : BLOG_COMMENT_STATUSES.includes(filters.status) ? (filters.status as BlogCommentStatus) : "__none__";

  const [reviewPage, recipeReviewPage, blogCommentPage] = await Promise.all([
    reviewStatus === "__none__"
      ? { items: [] as reviewRepository.ReviewAdminRow[], total: 0 }
      : reviewRepository.listReviewsForAdmin({ status: reviewStatus, rating: filters.rating, search: filters.search }, 1, depth),
    recipeStatus === "__none__"
      ? { items: [] as recipeReviewRepository.RecipeReviewAdminRow[], total: 0 }
      : recipeReviewRepository.listRecipeReviewsForAdmin({ status: recipeStatus, rating: filters.rating, search: filters.search }, 1, depth),
    blogStatus === "__none__"
      ? { items: [] as blogRepository.BlogCommentAdminListRow[], total: 0 }
      : blogRepository.listCommentsForAdmin({ status: blogStatus, search: filters.search }, 1, depth),
  ]);

  const merged: ModerationQueueItem[] = [
    ...reviewPage.items.map(toReviewItem),
    ...recipeReviewPage.items.map(toRecipeReviewItem),
    ...blogCommentPage.items.map(toBlogCommentItem),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const start = (page - 1) * pageSize;
  const items = merged.slice(start, start + pageSize);
  const total = reviewPage.total + recipeReviewPage.total + blogCommentPage.total;
  return { items, total };
}

async function requireReviewRow(id: string) {
  const row = await reviewRepository.findReviewAdminRowById(id);
  if (!row) throw new ReviewModerationNotFoundError();
  return row;
}

async function requireRecipeReviewRow(id: string) {
  const row = await recipeReviewRepository.findRecipeReviewAdminRowById(id);
  if (!row) throw new ReviewModerationNotFoundError();
  return row;
}

async function requireCommentRow(id: string) {
  const row = await blogRepository.findCommentAdminRowById(id);
  if (!row) throw new ReviewModerationNotFoundError();
  return row;
}

async function transitionReview(adminUserId: string, id: string, nextStatus: ReviewStatus, action: string): Promise<ModerationQueueItem> {
  const row = await requireReviewRow(id);
  if (!canTransitionReview(row.status, nextStatus)) throw new ReviewModerationIllegalTransitionError(row.status, nextStatus);
  await changeReviewStatus(id, nextStatus, { moderatorId: adminUserId });
  await writeAuditLog({ actorId: adminUserId, action, module: "Reviews", targetType: "Review", targetId: id, metadata: { from: row.status, to: nextStatus } });
  if (nextStatus === "Approved") {
    await sendNotification({ userId: row.userId, templateKey: "review.approved", variables: { productName: row.product.name }, triggeringEventId: id });
  }
  return toReviewItem(await requireReviewRow(id));
}

async function transitionRecipeReview(adminUserId: string, id: string, nextStatus: RecipeReviewStatus, action: string): Promise<ModerationQueueItem> {
  const row = await requireRecipeReviewRow(id);
  if (!canTransitionRecipeReview(row.status, nextStatus)) throw new ReviewModerationIllegalTransitionError(row.status, nextStatus);
  await changeRecipeReviewStatus(id, nextStatus, { moderatorId: adminUserId });
  await writeAuditLog({ actorId: adminUserId, action, module: "Reviews", targetType: "RecipeReview", targetId: id, metadata: { from: row.status, to: nextStatus } });
  if (nextStatus === "Approved") {
    await sendNotification({ userId: row.customerId, templateKey: "recipe_review.approved", variables: { recipeTitle: row.recipe.title }, triggeringEventId: id });
  }
  return toRecipeReviewItem(await requireRecipeReviewRow(id));
}

async function transitionComment(adminUserId: string, id: string, nextStatus: BlogCommentStatus, action: string): Promise<ModerationQueueItem> {
  const row = await requireCommentRow(id);
  if (!canTransitionComment(row.status, nextStatus)) throw new ReviewModerationIllegalTransitionError(row.status, nextStatus);
  await changeCommentStatus(id, nextStatus);
  await writeAuditLog({ actorId: adminUserId, action, module: "Reviews", targetType: "BlogComment", targetId: id, metadata: { from: row.status, to: nextStatus } });
  // No notification/recalculation for blog comments — no rating to recalculate (plan's scope note).
  return toBlogCommentItem(await requireCommentRow(id));
}

export async function approve(adminUserId: string, sourceType: ModerationSourceType, id: string): Promise<ModerationQueueItem> {
  await requirePermission(adminUserId, "Reviews", "Approve");
  if (sourceType === "product") return transitionReview(adminUserId, id, "Approved", "review_approved");
  if (sourceType === "recipe") return transitionRecipeReview(adminUserId, id, "Approved", "review_approved");
  return transitionComment(adminUserId, id, "Approved", "review_approved");
}

export async function reject(adminUserId: string, sourceType: ModerationSourceType, id: string): Promise<ModerationQueueItem> {
  await requirePermission(adminUserId, "Reviews", "Approve");
  if (sourceType === "product") return transitionReview(adminUserId, id, "Rejected", "review_rejected");
  if (sourceType === "recipe") return transitionRecipeReview(adminUserId, id, "Rejected", "review_rejected");
  return transitionComment(adminUserId, id, "Rejected", "review_rejected");
}

export async function hide(adminUserId: string, sourceType: ModerationSourceType, id: string): Promise<ModerationQueueItem> {
  await requirePermission(adminUserId, "Reviews", "Approve");
  if (sourceType === "product") return transitionReview(adminUserId, id, "Hidden", "review_hidden");
  if (sourceType === "recipe") return transitionRecipeReview(adminUserId, id, "Hidden", "review_hidden");
  return transitionComment(adminUserId, id, "Hidden", "review_hidden");
}

/** Product reviews only — Approved -> Published is a distinct step from Approve, since Approved isn't yet publicly visible (unlike recipe/blog, where Approved IS visible). */
export async function publish(adminUserId: string, id: string): Promise<ModerationQueueItem> {
  await requirePermission(adminUserId, "Reviews", "Approve");
  return transitionReview(adminUserId, id, "Published", "review_published");
}

/** Product reviews only. */
export async function archive(adminUserId: string, id: string): Promise<ModerationQueueItem> {
  await requirePermission(adminUserId, "Reviews", "Approve");
  return transitionReview(adminUserId, id, "Archived", "review_archived");
}

/** Product reviews only — recipe/blog Hidden is terminal in their own already-shipped STORY-021/022 design, not reopened here. */
export async function restore(adminUserId: string, id: string): Promise<ModerationQueueItem> {
  await requirePermission(adminUserId, "Reviews", "Approve");
  return transitionReview(adminUserId, id, "Published", "review_restored");
}

export async function reply(adminUserId: string, sourceType: ModerationSourceType, id: string, body: string): Promise<ModerationQueueItem> {
  await requirePermission(adminUserId, "Reviews", "Edit");
  if (sourceType === "product") {
    await requireReviewRow(id);
    await setReviewAdminReply(id, body);
    await writeAuditLog({ actorId: adminUserId, action: "review_replied", module: "Reviews", targetType: "Review", targetId: id });
    return toReviewItem(await requireReviewRow(id));
  }
  if (sourceType === "recipe") {
    await requireRecipeReviewRow(id);
    await setRecipeReviewAdminReply(id, body);
    await writeAuditLog({ actorId: adminUserId, action: "review_replied", module: "Reviews", targetType: "RecipeReview", targetId: id });
    return toRecipeReviewItem(await requireRecipeReviewRow(id));
  }
  await requireCommentRow(id);
  await setCommentAdminReply(id, body);
  await writeAuditLog({ actorId: adminUserId, action: "review_replied", module: "Reviews", targetType: "BlogComment", targetId: id });
  return toBlogCommentItem(await requireCommentRow(id));
}

export async function setFeatured(adminUserId: string, sourceType: ModerationSourceType, id: string, featured: boolean): Promise<ModerationQueueItem> {
  await requirePermission(adminUserId, "Reviews", "Edit");
  if (sourceType === "blog-comment") throw new ReviewModerationFeatureNotSupportedError();
  if (sourceType === "product") {
    await requireReviewRow(id);
    await setReviewFeatured(id, featured);
    await writeAuditLog({ actorId: adminUserId, action: "review_featured", module: "Reviews", targetType: "Review", targetId: id, metadata: { featured } });
    return toReviewItem(await requireReviewRow(id));
  }
  await requireRecipeReviewRow(id);
  await setRecipeReviewFeatured(id, featured);
  await writeAuditLog({ actorId: adminUserId, action: "review_featured", module: "Reviews", targetType: "RecipeReview", targetId: id, metadata: { featured } });
  return toRecipeReviewItem(await requireRecipeReviewRow(id));
}

/** Resolves the submitting customer's userId from the target row — a guest blog comment (customerId null) has no wallet to credit. */
async function resolveCustomerId(sourceType: ModerationSourceType, id: string): Promise<string> {
  if (sourceType === "product") return (await requireReviewRow(id)).userId;
  if (sourceType === "recipe") return (await requireRecipeReviewRow(id)).customerId;
  const row = await requireCommentRow(id);
  if (!row.customerId) throw new ReviewModerationRewardTargetInvalidError();
  return row.customerId;
}

export async function rewardCustomer(adminUserId: string, sourceType: ModerationSourceType, id: string, points: number, note: string): Promise<void> {
  await requirePermission(adminUserId, "Reviews", "Approve");
  const customerId = await resolveCustomerId(sourceType, id);
  await grantManualPoints(customerId, points, note);
  await writeAuditLog({ actorId: adminUserId, action: "review_customer_rewarded", module: "Reviews", targetType: sourceType, targetId: id, metadata: { points, note } });
}

export interface BulkModerationResult {
  updated: { sourceType: ModerationSourceType; id: string }[];
  skipped: { sourceType: ModerationSourceType; id: string }[];
}

export async function bulkModerate(adminUserId: string, items: { sourceType: ModerationSourceType; id: string }[], action: "approve" | "reject"): Promise<BulkModerationResult> {
  await requirePermission(adminUserId, "Reviews", "Approve");
  const updated: { sourceType: ModerationSourceType; id: string }[] = [];
  const skipped: { sourceType: ModerationSourceType; id: string }[] = [];
  for (const item of items) {
    try {
      if (action === "approve") await approve(adminUserId, item.sourceType, item.id);
      else await reject(adminUserId, item.sourceType, item.id);
      updated.push(item);
    } catch {
      skipped.push(item);
    }
  }
  return { updated, skipped };
}
