export type BlogAdminErrorCode =
  | "not_found"
  | "slug_conflict"
  | "not_draft"
  | "comment_not_found"
  | "illegal_comment_transition"
  | "author_not_found"
  | "author_slug_conflict"
  | "author_in_use";

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

export class BlogAuthorNotFoundError extends BlogAdminError {
  constructor() {
    super("author_not_found", "Author not found.");
  }
}

export class BlogAuthorSlugConflictError extends BlogAdminError {
  constructor() {
    super("author_slug_conflict", "An author with this slug already exists.");
  }
}

/** BlogPost.authorId has no onDelete: Cascade — an author with existing posts can't be deleted outright, mirroring BlogPostNotDraftError's own "real history, not scratch state" guard above. */
export class BlogAuthorInUseError extends BlogAdminError {
  constructor() {
    super("author_in_use", "This author has existing posts and can't be deleted. Reassign those posts to a different author first.");
  }
}
