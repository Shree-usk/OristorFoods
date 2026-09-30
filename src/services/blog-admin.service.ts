import { Prisma, type BlogCommentStatus } from "@/generated/prisma/client";
import * as blogRepository from "@/repositories/blog.repository";
import type { BlogPostAdminDetail, BlogPostAdminListFilters, BlogPostAdminWriteInput } from "@/repositories/blog.repository";
import { canTransitionComment, changeCommentStatus } from "@/services/blog.service";
import { getRecipeCardsBySlugs } from "@/services/recipe.service";
import { writeAuditLog } from "@/services/audit-log.service";
import { requirePermission } from "@/services/permission.service";
import { BlogCommentIllegalTransitionError, BlogCommentNotFoundError, BlogPostNotDraftError, BlogPostNotFoundError, BlogPostSlugConflictError } from "@/services/blog-admin.errors";
import { computeReadingTimeMinutes } from "@/lib/blog-reading-time";
export { deriveEffectiveStatus, type BlogPostEffectiveStatus } from "@/lib/blog-post-status";
import { parseBodyBlocks } from "@/lib/blog-body-blocks";
import type { BlogPostAdminValidatedInput } from "@/validation/blog-admin.schema";

function toWriteInput(input: BlogPostAdminValidatedInput): BlogPostAdminWriteInput {
  return { ...input, readingTimeMinutes: computeReadingTimeMinutes(input.bodyContent) };
}

function isUniqueConstraintViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Mirrors recipe-admin.service.ts's conflictField — the @prisma/adapter-pg driver reports a P2002's violated column(s) under meta.driverAdapterError.cause.constraint.fields, not the classic meta.target shape. */
function conflictField(error: Prisma.PrismaClientKnownRequestError): string | undefined {
  const meta = error.meta as { target?: unknown; driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } } } | undefined;
  const adapterFields = meta?.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(adapterFields) && typeof adapterFields[0] === "string") return adapterFields[0];
  const target = meta?.target;
  if (Array.isArray(target)) return target[0] as string;
  if (typeof target === "string") return target;
  return undefined;
}

function mapWriteError(error: unknown, slug: string): never {
  if (isUniqueConstraintViolation(error) && conflictField(error) === "slug") throw new BlogPostSlugConflictError(slug);
  throw error;
}

async function requirePost(id: string): Promise<BlogPostAdminDetail> {
  const post = await blogRepository.findBlogPostAdminDetailById(id);
  if (!post) throw new BlogPostNotFoundError();
  return post;
}

export async function getPostFormReferenceData(adminUserId: string) {
  await requirePermission(adminUserId, "Blog", "View");
  const [authors, tags] = await Promise.all([blogRepository.listAllBlogAuthorsForAdmin(), blogRepository.listAllBlogTagsForAdmin()]);
  return { authors, tags };
}

export async function listPostsForAdmin(adminUserId: string, filters: BlogPostAdminListFilters, page: number, pageSize: number) {
  await requirePermission(adminUserId, "Blog", "View");
  return blogRepository.listBlogPostsForAdmin(filters, page, pageSize);
}

export async function getPostForAdmin(adminUserId: string, id: string): Promise<BlogPostAdminDetail> {
  await requirePermission(adminUserId, "Blog", "View");
  return requirePost(id);
}

/**
 * Admin-only preview: any status, not just Published — parses the exact
 * same body markdown through parseBodyBlocks() and resolves recipe embeds
 * through getRecipeCardsBySlugs(), the same functions blog.service.ts's
 * getPostBySlug() uses, so the preview render (through BlogPostBody, the
 * real storefront component) can never structurally drift from
 * /blog/[slug]. Comments and related-posts are skipped — neither is
 * meaningful for an unpublished draft, matching Recipe's own admin
 * preview precedent of dropping customer-account-dependent pieces.
 */
export async function getPostForPreview(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "Blog", "View");
  const row = await requirePost(id);

  const blocks = parseBodyBlocks(row.bodyContent);
  const recipeSlugs = blocks.filter((block) => block.kind === "recipeEmbed").map((block) => block.slug);
  const recipeCardList = await getRecipeCardsBySlugs(recipeSlugs);
  const recipeCards = Object.fromEntries(recipeCardList.map((card) => [card.slug, card]));

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    heroImageUrl: row.heroImageUrl,
    readingTimeMinutes: row.readingTimeMinutes,
    authorName: row.author.name,
    authorSlug: row.author.slug,
    authorBio: row.author.bio,
    authorAvatarUrl: row.author.avatarUrl,
    blocks,
    recipeCards,
  };
}

export async function createPost(adminUserId: string, input: BlogPostAdminValidatedInput): Promise<BlogPostAdminDetail> {
  await requirePermission(adminUserId, "Blog", "Edit");
  try {
    const created = await blogRepository.createBlogPostAdmin(toWriteInput(input), adminUserId);
    await writeAuditLog({ actorId: adminUserId, action: "blog_post_created", module: "Blog", targetType: "BlogPost", targetId: created.id });
    return created;
  } catch (error) {
    mapWriteError(error, input.slug);
  }
}

export async function updatePost(adminUserId: string, id: string, input: BlogPostAdminValidatedInput): Promise<BlogPostAdminDetail> {
  await requirePermission(adminUserId, "Blog", "Edit");
  await requirePost(id);
  try {
    const updated = await blogRepository.updateBlogPostAdmin(id, toWriteInput(input), adminUserId);
    await writeAuditLog({ actorId: adminUserId, action: "blog_post_updated", module: "Blog", targetType: "BlogPost", targetId: id });
    return updated;
  } catch (error) {
    mapWriteError(error, input.slug);
  }
}

/** Only a Draft post may be deleted — anything that's ever been live is real history, not scratch state, matching Recipe's own Draft-only delete guard. */
export async function deletePost(adminUserId: string, id: string): Promise<void> {
  await requirePermission(adminUserId, "Blog", "Delete");
  const post = await requirePost(id);
  if (post.status !== "Draft") throw new BlogPostNotDraftError();

  await blogRepository.deleteBlogPostById(id);
  await writeAuditLog({ actorId: adminUserId, action: "blog_post_deleted", module: "Blog", targetType: "BlogPost", targetId: id });
}

/** Publishing always writes status "Published" — publishedAt in the future is how a post gets scheduled (see deriveEffectiveStatus above). Defaults to now when no date is supplied. */
export async function publishPost(adminUserId: string, id: string, publishedAt?: Date): Promise<BlogPostAdminDetail> {
  await requirePermission(adminUserId, "Blog", "Edit");
  await requirePost(id);
  const updated = await blogRepository.updateBlogPostStatus(id, { status: "Published", publishedAt: publishedAt ?? new Date() });
  await writeAuditLog({ actorId: adminUserId, action: "blog_post_published", module: "Blog", targetType: "BlogPost", targetId: id, metadata: { publishedAt: (publishedAt ?? new Date()).toISOString() } });
  return updated;
}

export async function archivePost(adminUserId: string, id: string): Promise<BlogPostAdminDetail> {
  await requirePermission(adminUserId, "Blog", "Edit");
  await requirePost(id);
  const updated = await blogRepository.updateBlogPostStatus(id, { status: "Archived" });
  await writeAuditLog({ actorId: adminUserId, action: "blog_post_archived", module: "Blog", targetType: "BlogPost", targetId: id });
  return updated;
}

/** Archived -> Draft, matching Recipe's own restore-to-Draft precedent. */
export async function restorePost(adminUserId: string, id: string): Promise<BlogPostAdminDetail> {
  await requirePermission(adminUserId, "Blog", "Edit");
  await requirePost(id);
  const updated = await blogRepository.updateBlogPostStatus(id, { status: "Draft", publishedAt: null });
  await writeAuditLog({ actorId: adminUserId, action: "blog_post_restored", module: "Blog", targetType: "BlogPost", targetId: id });
  return updated;
}

// --- Comment moderation ---
// Wraps blog.service.ts's existing canTransitionComment/changeCommentStatus
// (built for STORY-021, left unwired to any admin surface) with permission
// checks and audit logging, rather than reimplementing the transition
// table here.

export async function listCommentsForAdmin(adminUserId: string, filters: blogRepository.BlogCommentAdminListFilters, page: number, pageSize: number) {
  await requirePermission(adminUserId, "Blog", "View");
  return blogRepository.listCommentsForAdmin(filters, page, pageSize);
}

async function requireComment(commentId: string) {
  const comment = await blogRepository.findCommentById(commentId);
  if (!comment) throw new BlogCommentNotFoundError();
  return comment;
}

async function moderateOne(adminUserId: string, commentId: string, nextStatus: BlogCommentStatus, action: string) {
  await requirePermission(adminUserId, "Blog", "Approve");
  const comment = await requireComment(commentId);
  if (!canTransitionComment(comment.status, nextStatus)) throw new BlogCommentIllegalTransitionError(comment.status, nextStatus);

  const updated = await changeCommentStatus(commentId, nextStatus);
  await writeAuditLog({ actorId: adminUserId, action, module: "Blog", targetType: "BlogComment", targetId: commentId, metadata: { from: comment.status, to: nextStatus } });
  return updated;
}

export const approveComment = (adminUserId: string, commentId: string) => moderateOne(adminUserId, commentId, "Approved", "blog_comment_approved");
export const rejectComment = (adminUserId: string, commentId: string) => moderateOne(adminUserId, commentId, "Rejected", "blog_comment_rejected");
export const hideComment = (adminUserId: string, commentId: string) => moderateOne(adminUserId, commentId, "Hidden", "blog_comment_hidden");

export async function deleteComment(adminUserId: string, commentId: string): Promise<void> {
  await requirePermission(adminUserId, "Blog", "Delete");
  await requireComment(commentId);
  await blogRepository.deleteComment(commentId);
  await writeAuditLog({ actorId: adminUserId, action: "blog_comment_deleted", module: "Blog", targetType: "BlogComment", targetId: commentId });
}

/**
 * Bulk approve/reject across a filtered selection. Each id is validated
 * against the real transition table before being included — a comment
 * that isn't actually Pending (e.g. already Approved, stale client state)
 * is silently skipped rather than failing the whole batch, and reported
 * back so the UI can tell the admin what happened.
 */
export async function bulkModerateComments(adminUserId: string, commentIds: string[], action: "approve" | "reject"): Promise<{ updated: string[]; skipped: string[] }> {
  await requirePermission(adminUserId, "Blog", "Approve");
  const nextStatus: BlogCommentStatus = action === "approve" ? "Approved" : "Rejected";

  const comments = await Promise.all(commentIds.map((id) => blogRepository.findCommentById(id)));
  const updated: string[] = [];
  const skipped: string[] = [];
  for (const [index, comment] of comments.entries()) {
    const id = commentIds[index];
    if (!comment || !canTransitionComment(comment.status, nextStatus)) {
      skipped.push(id);
      continue;
    }
    updated.push(id);
  }

  if (updated.length > 0) {
    await blogRepository.bulkUpdateCommentStatus(updated, nextStatus);
    await writeAuditLog({ actorId: adminUserId, action: action === "approve" ? "blog_comment_approved" : "blog_comment_rejected", module: "Blog", targetType: "BlogComment", targetId: updated.join(","), metadata: { bulk: true, count: updated.length } });
  }

  return { updated, skipped };
}
