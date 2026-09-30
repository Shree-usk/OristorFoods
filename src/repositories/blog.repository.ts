import type { BlogCommentStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export const blogPostCardSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  heroImageUrl: true,
  publishedAt: true,
  readingTimeMinutes: true,
  author: { select: { name: true, slug: true } },
  tags: { select: { tag: { select: { name: true, slug: true } } } },
} satisfies Prisma.BlogPostSelect;

export type BlogPostCardRow = Prisma.BlogPostGetPayload<{ select: typeof blogPostCardSelect }>;

function publishedWhere(now: Date, restWhere: Prisma.BlogPostWhereInput = {}): Prisma.BlogPostWhereInput {
  return { AND: [{ status: "Published" }, { publishedAt: { lte: now } }, restWhere] };
}

export async function findPublishedBlogPosts(args: {
  where: Prisma.BlogPostWhereInput;
  skip: number;
  take: number;
}): Promise<{ rows: BlogPostCardRow[]; total: number }> {
  // Strip any caller-supplied status/publishedAt before composing: see the
  // Global Constraints note on why this must be a destructure, never a
  // spread, and why both fields (not just status) must be stripped here.
  const { status: _callerStatus, publishedAt: _callerPublishedAt, ...restWhere } = args.where;
  const now = new Date();
  const where = publishedWhere(now, restWhere);
  const [rows, total] = await prisma.$transaction([
    prisma.blogPost.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      skip: args.skip,
      take: args.take,
      select: blogPostCardSelect,
    }),
    prisma.blogPost.count({ where }),
  ]);
  return { rows, total };
}

export const blogPostDetailSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  heroImageUrl: true,
  bodyContent: true,
  publishedAt: true,
  readingTimeMinutes: true,
  authorId: true,
  author: { select: { name: true, slug: true, bio: true, avatarUrl: true } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
  comments: {
    where: { status: "Approved" },
    orderBy: { createdAt: "asc" },
    select: { id: true, authorName: true, body: true, createdAt: true },
  },
} satisfies Prisma.BlogPostSelect;

export type BlogPostDetailRow = Prisma.BlogPostGetPayload<{ select: typeof blogPostDetailSelect }>;

export function findPublishedBlogPostBySlug(slug: string): Promise<BlogPostDetailRow | null> {
  const now = new Date();
  return prisma.blogPost.findFirst({
    where: { slug, status: "Published", publishedAt: { lte: now } },
    select: blogPostDetailSelect,
  });
}

/** A lightweight existence check — used by comment submission, which only
 *  needs the post's id, not its full detail payload (comments, tags,
 *  author bio). Avoids the comments route paying for a detail-page-sized
 *  query just to confirm the post exists and is commentable. */
export function findPublishedBlogPostIdBySlug(slug: string): Promise<{ id: string } | null> {
  const now = new Date();
  return prisma.blogPost.findFirst({
    where: { slug, status: "Published", publishedAt: { lte: now } },
    select: { id: true },
  });
}

export async function findRelatedBlogPosts(
  post: { id: string; authorId: string; tagIds: string[] },
  limit: number,
): Promise<BlogPostCardRow[]> {
  const now = new Date();
  const sameAuthorOrTag = await prisma.blogPost.findMany({
    where: {
      status: "Published",
      publishedAt: { lte: now },
      id: { not: post.id },
      OR: [{ authorId: post.authorId }, { tags: { some: { tagId: { in: post.tagIds } } } }],
    },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take: limit,
    select: blogPostCardSelect,
  });
  if (sameAuthorOrTag.length >= limit) return sameAuthorOrTag;

  const fallback = await prisma.blogPost.findMany({
    where: {
      status: "Published",
      publishedAt: { lte: now },
      id: { notIn: [post.id, ...sameAuthorOrTag.map((p) => p.id)] },
    },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take: limit - sameAuthorOrTag.length,
    select: blogPostCardSelect,
  });
  return [...sameAuthorOrTag, ...fallback];
}

const now = () => new Date();

export function findActiveBlogTags(): Promise<{ id: string; name: string; slug: string }[]> {
  return prisma.blogTag.findMany({
    where: { posts: { some: { post: { status: "Published", publishedAt: { lte: now() } } } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true, slug: true },
  });
}

export function findActiveBlogAuthorsWithPublishedPosts(): Promise<{ id: string; name: string; slug: string }[]> {
  return prisma.blogAuthor.findMany({
    where: { posts: { some: { status: "Published", publishedAt: { lte: now() } } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true, slug: true },
  });
}

export function createBlogComment(data: Omit<Prisma.BlogCommentUncheckedCreateInput, "status">) {
  // status is never caller-controlled — every comment starts Pending,
  // full stop. Callers cannot even accidentally pass a different status:
  // the parameter type excludes the field entirely.
  return prisma.blogComment.create({ data: { ...data, status: "Pending" } });
}

export function findRecentCommentByIdentity(
  postId: string,
  identity: { authorEmail: string } | { customerId: string },
  since: Date,
): Promise<{ id: string } | null> {
  return prisma.blogComment.findFirst({
    where: { postId, createdAt: { gte: since }, ...identity },
    select: { id: true },
  });
}

/** The only mutation function — canTransitionComment/changeCommentStatus (Task 5) call this after validating the transition. */
export function updateCommentStatus(commentId: string, status: BlogCommentStatus) {
  return prisma.blogComment.update({ where: { id: commentId }, data: { status } });
}

export function findCommentById(commentId: string) {
  return prisma.blogComment.findUnique({ where: { id: commentId } });
}

/** STORY-039. Dashboard's Pending Moderation widget. */
export function countPendingComments() {
  return prisma.blogComment.count({ where: { status: "Pending" } });
}

/** Looks up a signed-in commenter's canonical name/email from the User
 *  table. The comments route must not trust `session.user.name`/`email`
 *  directly — auth uses the JWT strategy, so those claims are only as
 *  fresh as the user's last sign-in and can go stale after a profile
 *  update. */
export function findUserIdentityById(userId: string): Promise<{ name: string | null; email: string | null } | null> {
  return prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
}
