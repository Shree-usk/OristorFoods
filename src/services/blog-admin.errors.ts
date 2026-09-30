export type BlogAdminErrorCode = "not_found" | "slug_conflict" | "not_draft" | "comment_not_found" | "illegal_comment_transition";

export class BlogAdminError extends Error {
  constructor(
    public readonly code: BlogAdminErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BlogAdminError";
  }
}

export class BlogPostNotFoundError extends BlogAdminError {
  constructor() {
    super("not_found", "Blog post not found.");
  }
}

export class BlogPostSlugConflictError extends BlogAdminError {
  constructor(public readonly slug: string) {
    super("slug_conflict", `A blog post with slug "${slug}" already exists.`);
  }
}

/** Only a Draft post may be deleted — a post that has ever been live is real history, not scratch state, matching Recipe's own Draft-only delete guard. */
export class BlogPostNotDraftError extends BlogAdminError {
  constructor() {
    super("not_draft", "Only a Draft post can be deleted.");
  }
}

export class BlogCommentNotFoundError extends BlogAdminError {
  constructor() {
    super("comment_not_found", "Comment not found.");
  }
}

/** Wraps blog.service.ts's canTransitionComment false case with a typed error instead of its current bare Error, so the admin API can map it to a proper status code. */
export class BlogCommentIllegalTransitionError extends BlogAdminError {
  constructor(from: string, to: string) {
    super("illegal_comment_transition", `Cannot change comment status from ${from} to ${to}.`);
  }
}
