import { z } from "zod";

export const blogListQuerySchema = z.object({
  tag: z.string().trim().min(1).optional().catch(undefined),
  author: z.string().trim().min(1).optional().catch(undefined),
  page: z.coerce.number().int().positive().catch(1),
  pageSize: z.coerce.number().int().positive().max(48).catch(12),
});
export type BlogListQuery = z.infer<typeof blogListQuerySchema>;

export const blogSlugParamSchema = z.object({
  slug: z.string().min(1),
});

/**
 * `name`/`email` are optional at the schema level because a logged-in
 * customer's request omits them (the service reads identity from the
 * session instead). The service enforces that a request WITHOUT a session
 * must supply both — that requires the session, which this schema cannot
 * see, so it is not a validation-layer rule.
 */
export const blogCommentInputSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.email("Enter a valid email address").optional(),
  body: z.string().trim().min(3, "Comment is too short").max(2000, "Comment is too long"),
  honeypot: z.string().max(0, "Invalid submission"),
});
export type BlogCommentInput = z.infer<typeof blogCommentInputSchema>;
