import { readApiError, type ApiError } from "@/lib/api/api-error";
import type { BlogCommentInput } from "@/validation/blog.schema";

/** Browser-side wrapper around the blog comments API (STORY-021). */
export type BlogCommentApiError = ApiError<keyof BlogCommentInput>;

export async function postComment(postSlug: string, input: BlogCommentInput): Promise<{ status: "pending-review" }> {
  const response = await fetch(`/api/blog/${encodeURIComponent(postSlug)}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await readApiError<keyof BlogCommentInput>(response);
  return (await response.json()) as { status: "pending-review" };
}
