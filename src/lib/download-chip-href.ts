/**
 * Builds a `/downloads?...` href for a category filter chip, matching
 * buildBlogChipHref's shape (STORY-021) adapted to a single filter
 * dimension. `category: undefined` explicitly clears the filter (the "All"
 * chip) rather than being indistinguishable from "leave it alone" — same
 * `in` operator reasoning as the blog precedent.
 */
export function buildDownloadChipHref(query: { category?: string }, overrides: { category?: string }): string {
  const params = new URLSearchParams();
  const category = "category" in overrides ? overrides.category : query.category;
  if (category) params.set("category", category);
  const qs = params.toString();
  return qs ? `/downloads?${qs}` : "/downloads";
}
