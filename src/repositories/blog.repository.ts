import type { BlogCommentStatus, BlogPostStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { escapeLikePattern } from "@/lib/escape-like-pattern";

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
  metaTitle: true,
  metaDescription: true,
  ogImage: true,
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

// --- STORY-044 admin authoring & comment moderation ---

/** Unlike blogPostDetailSelect (storefront, Published-only shape), this includes status/audit fields and every field the builder edits, with no Approved-comments-only filter on `comments`. */
export const blogPostAdminDetailSelect = {
  id: true,
  slug: true,
  title: true,
  heroImageUrl: true,
  excerpt: true,
  bodyContent: true,
  authorId: true,
  readingTimeMinutes: true,
  status: true,
  publishedAt: true,
  metaTitle: true,
  metaDescription: true,
  ogImage: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true, slug: true, bio: true, avatarUrl: true } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
} satisfies Prisma.BlogPostSelect;

export type BlogPostAdminDetail = Prisma.BlogPostGetPayload<{ select: typeof blogPostAdminDetailSelect }>;

export function findBlogPostAdminDetailById(id: string): Promise<BlogPostAdminDetail | null> {
  return prisma.blogPost.findUnique({ where: { id }, select: blogPostAdminDetailSelect });
}

export function findBlogPostBySlugForAdmin(slug: string) {
  return prisma.blogPost.findUnique({ where: { slug }, select: { id: true } });
}

export function listAllBlogAuthorsForAdmin() {
  return prisma.blogAuthor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } });
}

export function listAllBlogTagsForAdmin() {
  return prisma.blogTag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } });
}

/** "Live"/"Scheduled" are display labels, not `BlogPostStatus` values — both filter on the stored `Published` status, split by `publishedAt` vs. now. See blog-admin.service.ts. */
export type BlogPostAdminStatusFilter = "Draft" | "Scheduled" | "Live" | "Archived";

export interface BlogPostAdminListFilters {
  status?: BlogPostAdminStatusFilter;
  search?: string;
}

function blogPostAdminStatusWhere(status: BlogPostAdminStatusFilter): Prisma.BlogPostWhereInput {
  switch (status) {
    case "Live":
      return { status: "Published", publishedAt: { lte: new Date() } };
    case "Scheduled":
      return { status: "Published", publishedAt: { gt: new Date() } };
    case "Draft":
    case "Archived":
      return { status };
  }
}

const blogPostAdminListSelect = {
  id: true,
  slug: true,
  title: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
  author: { select: { name: true } },
} satisfies Prisma.BlogPostSelect;

export type BlogPostAdminListRow = Prisma.BlogPostGetPayload<{ select: typeof blogPostAdminListSelect }>;

/** `status` here is the real stored enum value (Draft/Published/Archived — "Scheduled" is never written, see blog-admin.service.ts). The admin list computes the Scheduled-vs-Live label itself from status+publishedAt. */
export async function listBlogPostsForAdmin(filters: BlogPostAdminListFilters, page: number, pageSize: number): Promise<{ items: BlogPostAdminListRow[]; total: number }> {
  const where: Prisma.BlogPostWhereInput = {
    ...(filters.status ? blogPostAdminStatusWhere(filters.status) : {}),
    ...(filters.search ? { title: { contains: escapeLikePattern(filters.search), mode: "insensitive" as const } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.blogPost.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize, select: blogPostAdminListSelect }),
    prisma.blogPost.count({ where }),
  ]);
  return { items, total };
}

export interface BlogPostAdminWriteInput {
  slug: string;
  title: string;
  excerpt: string;
  heroImageUrl?: string | null;
  bodyContent: string;
  authorId: string;
  readingTimeMinutes?: number | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImage?: string | null;
  tagIds: string[];
}

export function createBlogPostAdmin(input: BlogPostAdminWriteInput, adminUserId: string) {
  return prisma.blogPost.create({
    data: {
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt,
      heroImageUrl: input.heroImageUrl ?? null,
      bodyContent: input.bodyContent,
      authorId: input.authorId,
      readingTimeMinutes: input.readingTimeMinutes ?? null,
      metaTitle: input.metaTitle ?? null,
      metaDescription: input.metaDescription ?? null,
      ogImage: input.ogImage ?? null,
      createdById: adminUserId,
      updatedById: adminUserId,
      tags: input.tagIds.length ? { create: input.tagIds.map((tagId) => ({ tagId })) } : undefined,
    },
    select: blogPostAdminDetailSelect,
  });
}

/** Tags are always replace-all on update — the form always submits the full current tag list, never a partial patch, matching Recipe's dietary-tag/ingredient replace-all convention. */
export function updateBlogPostAdmin(id: string, input: BlogPostAdminWriteInput, adminUserId: string) {
  return prisma.blogPost.update({
    where: { id },
    data: {
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt,
      heroImageUrl: input.heroImageUrl ?? null,
      bodyContent: input.bodyContent,
      authorId: input.authorId,
      readingTimeMinutes: input.readingTimeMinutes ?? null,
      metaTitle: input.metaTitle ?? null,
      metaDescription: input.metaDescription ?? null,
      ogImage: input.ogImage ?? null,
      updatedById: adminUserId,
      tags: { deleteMany: {}, create: input.tagIds.map((tagId) => ({ tagId })) },
    },
    select: blogPostAdminDetailSelect,
  });
}

export function deleteBlogPostById(id: string) {
  return prisma.blogPost.delete({ where: { id } });
}

export function updateBlogPostStatus(id: string, data: { status: BlogPostStatus; publishedAt?: Date | null }) {
  return prisma.blogPost.update({ where: { id }, data, select: blogPostAdminDetailSelect });
}

// --- Comment moderation (admin) ---

export interface BlogCommentAdminListFilters {
  postId?: string;
  status?: BlogCommentStatus;
  search?: string;
}

const blogCommentAdminListSelect = {
  id: true,
  authorName: true,
  authorEmail: true,
  body: true,
  status: true,
  createdAt: true,
  post: { select: { id: true, slug: true, title: true } },
} satisfies Prisma.BlogCommentSelect;

export type BlogCommentAdminListRow = Prisma.BlogCommentGetPayload<{ select: typeof blogCommentAdminListSelect }>;

export async function listCommentsForAdmin(filters: BlogCommentAdminListFilters, page: number, pageSize: number): Promise<{ items: BlogCommentAdminListRow[]; total: number }> {
  const where: Prisma.BlogCommentWhereInput = {
    ...(filters.postId ? { postId: filters.postId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search ? { body: { contains: escapeLikePattern(filters.search), mode: "insensitive" as const } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.blogComment.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize, select: blogCommentAdminListSelect }),
    prisma.blogComment.count({ where }),
  ]);
  return { items, total };
}

export function deleteComment(commentId: string) {
  return prisma.blogComment.delete({ where: { id: commentId } });
}

export function bulkUpdateCommentStatus(commentIds: string[], status: BlogCommentStatus) {
  return prisma.blogComment.updateMany({ where: { id: { in: commentIds } }, data: { status } });
}
