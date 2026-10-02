import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Create and update share one shape — matches recipe-admin.schema.ts's convention. */
export const blogPostAdminSchema = z.object({
  slug: z.string().trim().min(1, "Slug is required.").regex(slugRegex, "Slug must be lowercase, alphanumeric, and hyphen-separated."),
  title: z.string().trim().min(1, "Title is required.").max(200),
  excerpt: z.string().trim().min(1, "Excerpt is required.").max(500),
  heroImageUrl: z.string().trim().max(2000).optional().or(z.literal("")).nullable(),
  bodyContent: z.string().trim().min(1, "Body content is required."),
  authorId: z.string().trim().min(1, "Author is required."),
  tagIds: z.array(z.string().min(1)).optional().default([]),
});

export type BlogPostAdminFormInput = z.input<typeof blogPostAdminSchema>;
/** readingTimeMinutes is deliberately absent — the service derives it via computeReadingTimeMinutes() so it can never drift from bodyContent (see src/lib/blog-reading-time.ts). */
export type BlogPostAdminValidatedInput = z.output<typeof blogPostAdminSchema>;

/** `publishedAt` omitted means "now" — a future date is how a post gets scheduled (see docs/architecture-decisions.md's STORY-044 entry on why "Scheduled" is never a stored status). */
export const publishBlogPostSchema = z.object({
  publishedAt: z.iso.datetime({ offset: true }).optional(),
});

/**
 * "Live" and "Scheduled" are not `BlogPostStatus` enum values (see
 * docs/architecture-decisions.md's STORY-044 entry) — both map to the
 * stored `Published` status, split by `publishedAt` vs. now. The service
 * layer does that translation; this schema just accepts the four labels
 * the admin list's filter actually shows.
 */
export const listBlogPostsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["Draft", "Scheduled", "Live", "Archived"]).optional(),
  search: z.string().trim().min(1).optional(),
});

export const listBlogCommentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  postId: z.string().trim().min(1).optional(),
  status: z.enum(["Pending", "Approved", "Rejected", "Hidden"]).optional(),
  search: z.string().trim().min(1).optional(),
});

export const bulkModerateCommentsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one comment."),
  action: z.enum(["approve", "reject"]),
});
