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
 * session instead). A request WITHOUT a session must supply both — that
 * requires knowing whether a session resolved, which this schema cannot
 * see, so it is not a rule this schema enforces itself. Instead,
 * `POST /api/blog/[slug]/comments` re-validates the guest path against
 * `blogGuestCommentInputSchema` below once it knows there is no session.
 */
export const blogCommentInputSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.email("Enter a valid email address").optional(),
  body: z.string().trim().min(3, "Comment is too short").max(2000, "Comment is too long"),
  /**
   * Shape-validation only ("is this a string") — deliberately no length
   * constraint here. The actual accept/reject decision on a filled
   * honeypot belongs entirely to `submitComment`'s runtime check
   * (`src/services/blog.service.ts`), which silently no-ops instead of
   * returning a distinguishable error. A `.max(0)` constraint here would
   * make the route's own `safeParse` reject a filled honeypot with a 400
   * before `submitComment` ever runs, defeating the "a bot must not be
   * able to tell honeypot/rate-limit/success apart" design.
   */
  honeypot: z.string(),
});
export type BlogCommentInput = z.infer<typeof blogCommentInputSchema>;

/**
 * The stricter variant enforced for a request with no session (see
 * `blogCommentInputSchema`'s doc comment above): `name`/`email` become
 * genuinely required here, not merely non-`undefined`. Used both by
 * `BlogCommentForm` (client-side, when `useSession()` reports no session)
 * and by `POST /api/blog/[slug]/comments` (server-side, when
 * `resolveCommentSession` returns `null`) — defined once and imported by
 * both so the two never drift apart.
 */
export const blogGuestCommentInputSchema = blogCommentInputSchema.extend({
  name: z.string({ error: "Name is required" }).trim().min(1, "Name is required").max(100),
  email: z.email("Enter a valid email address"),
});
export type BlogGuestCommentInput = z.infer<typeof blogGuestCommentInputSchema>;
