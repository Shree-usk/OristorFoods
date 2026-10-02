import type { BlogCommentStatus } from "@/generated/prisma/client";
import * as blogRepository from "@/repositories/blog.repository";
import type { BlogPostCardRow, BlogPostDetailRow } from "@/repositories/blog.repository";
import { parseBodyBlocks } from "@/lib/blog-body-blocks";
import { getRecipeCardsBySlugs } from "@/services/recipe.service";
import * as seoRepository from "@/repositories/seo.repository";
import type { BlogListResult, BlogPostCardData, BlogPostDetailData } from "@/types/blog";
import type { BlogCommentInput, BlogListQuery } from "@/validation/blog.schema";

const RATE_LIMIT_WINDOW_MS = 60_000;

// ---------------------------------------------------------------------------
// Comment moderation lifecycle — mirrors review.service.ts's shape exactly
// (an allowedTransitions table + a single mutation function). One fewer
// public state than Review's, since there is no separate
// Approved-but-not-yet-Published step for comments to wait on: Approved IS
// the visible state.
// ---------------------------------------------------------------------------

const allowedCommentTransitions: Record<BlogCommentStatus, readonly BlogCommentStatus[]> = {
  Pending: ["Approved", "Rejected"],
  Approved: ["Hidden"],
  Rejected: [],
  Hidden: [],
};

export function canTransitionComment(from: BlogCommentStatus, to: BlogCommentStatus): boolean {
  return allowedCommentTransitions[from].includes(to);
}

export async function changeCommentStatus(commentId: string, nextStatus: BlogCommentStatus) {
  const comment = await blogRepository.findCommentById(commentId);
  if (!comment) throw new Error(`Comment not found: ${commentId}`);
  if (!canTransitionComment(comment.status, nextStatus)) {
    throw new Error(`Cannot transition comment from ${comment.status} to ${nextStatus}`);
  }
  return blogRepository.updateCommentStatus(commentId, nextStatus);
}

/** STORY-045. A CS reply — no status change. */
export async function setCommentAdminReply(commentId: string, body: string) {
  const comment = await blogRepository.findCommentById(commentId);
  if (!comment) throw new Error(`Comment not found: ${commentId}`);
  return blogRepository.setCommentAdminReply(commentId, body);
}

/**
 * Walks a Pending comment to Approved through the real transition function,
 * for the seed and e2e tests only. In production, comments are approved
 * from the moderation console (Epic 07's STORY-044/045).
 */
export function advanceCommentToApproved(commentId: string) {
  return changeCommentStatus(commentId, "Approved");
}

function postHref(slug: string): string {
  return `/blog/${slug}`;
}

function toPostCard(row: BlogPostCardRow): BlogPostCardData {
  return {
    id: row.id,
    slug: row.slug,
    href: postHref(row.slug),
    title: row.title,
    excerpt: row.excerpt,
    heroImageUrl: row.heroImageUrl,
    authorName: row.author.name,
    authorSlug: row.author.slug,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    readingTimeMinutes: row.readingTimeMinutes,
    tags: row.tags.map((link) => link.tag),
  };
}

export async function listPosts(query: BlogListQuery): Promise<BlogListResult> {
  const { page, pageSize, tag, author } = query;
  const where = {
    ...(tag ? { tags: { some: { tag: { slug: tag } } } } : {}),
    ...(author ? { author: { slug: author } } : {}),
  };
  const { rows, total } = await blogRepository.findPublishedBlogPosts({
    where,
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return { posts: rows.map(toPostCard), total, page, pageSize };
}

export function listTags() {
  return blogRepository.findActiveBlogTags();
}

export function listAuthors() {
  return blogRepository.findActiveBlogAuthorsWithPublishedPosts();
}

export async function getPostBySlug(slug: string): Promise<BlogPostDetailData | null> {
  const row: BlogPostDetailRow | null = await blogRepository.findPublishedBlogPostBySlug(slug);
  if (!row) return null;

  const blocks = parseBodyBlocks(row.bodyContent);
  const recipeSlugs = blocks.filter((block) => block.kind === "recipeEmbed").map((block) => block.slug);

  const [relatedRows, recipeCardList, seoMeta] = await Promise.all([
    blogRepository.findRelatedBlogPosts({ id: row.id, authorId: row.authorId, tagIds: row.tags.map((t) => t.tag.id) }, 3),
    getRecipeCardsBySlugs(recipeSlugs),
    seoRepository.findSeoMeta("BlogPost", row.id),
  ]);

  const recipeCards = Object.fromEntries(recipeCardList.map((card) => [card.slug, card]));

  return {
    ...toPostCard(row),
    bodyContent: row.bodyContent,
    authorBio: row.author.bio,
    authorAvatarUrl: row.author.avatarUrl,
    comments: row.comments.map((c) => ({ id: c.id, authorName: c.authorName, body: c.body, createdAt: c.createdAt.toISOString() })),
    relatedPosts: relatedRows.map(toPostCard),
    recipeCards,
    metaTitle: seoMeta?.metaTitle ?? null,
    metaDescription: seoMeta?.metaDescription ?? null,
    ogImage: seoMeta?.ogImageUrl ?? null,
    robotsIndex: seoMeta?.robotsIndex ?? true,
    robotsFollow: seoMeta?.robotsFollow ?? true,
  };
}

/** Used by the comments route to confirm a commentable post exists, without
 *  paying for getPostBySlug's full detail-page query (embed resolution,
 *  related posts, comment list). */
export async function getPostIdBySlug(slug: string): Promise<string | null> {
  const row = await blogRepository.findPublishedBlogPostIdBySlug(slug);
  return row?.id ?? null;
}

export interface CommentSession {
  userId: string;
  name: string | null;
  email: string | null;
}

/**
 * Resolves a signed-in commenter's canonical identity from the User table
 * for the comments route to pass into `submitComment`. The route only
 * knows the session's `userId` is trustworthy — its `name`/`email` claims
 * come from a JWT and are not treated as a source of truth (see
 * `findUserIdentityById`).
 *
 * Returns `null` when the session's `userId` has no corresponding `User`
 * row (a deleted account, or a stale/forged JWT). The caller must treat
 * that exactly like an absent session — falling back to the guest path —
 * rather than passing a session-shaped object with a dangling `userId`
 * into `submitComment`, which would otherwise throw on the `customerId`
 * foreign key at insert time.
 */
export async function resolveCommentSession(userId: string): Promise<CommentSession | null> {
  const user = await blogRepository.findUserIdentityById(userId);
  if (!user) return null;
  return { userId, name: user.name, email: user.email };
}

export async function submitComment(
  postId: string,
  input: BlogCommentInput,
  session: CommentSession | null,
): Promise<{ status: "pending-review" }> {
  // Silent, generic response for every rejected path — see Global Constraints:
  // a bot must not be able to tell honeypot/rate-limit/success apart.
  if (input.honeypot.length > 0) {
    return { status: "pending-review" };
  }

  const authorName = session ? (session.name ?? "Oristor customer") : (input.name ?? "");
  const authorEmail = session ? (session.email ?? "") : (input.email ?? "");
  const identity = session ? { customerId: session.userId } : { authorEmail };

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const recent = await blogRepository.findRecentCommentByIdentity(postId, identity, since);
  if (recent) {
    return { status: "pending-review" };
  }

  await blogRepository.createBlogComment({
    postId,
    authorName,
    authorEmail,
    customerId: session?.userId,
    body: input.body,
  });
  return { status: "pending-review" };
}
