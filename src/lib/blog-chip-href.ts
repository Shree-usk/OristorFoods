interface BlogChipHrefQuery {
  tag?: string;
  author?: string;
}

interface BlogChipHrefOverrides {
  tag?: string;
  author?: string;
}

/**
 * Builds a `/blog?...` href for a filter chip (tag/author), preserving
 * whichever of the two the caller isn't overriding.
 *
 * Uses the `in` operator (property presence) rather than `!== undefined`
 * to decide whether a key was overridden. `{ tag: undefined }.tag` and a
 * simply-absent `tag` key both read as `undefined` in JS, so
 * `overrides.tag !== undefined` cannot tell "explicitly clear this filter"
 * apart from "leave this filter alone" — which made the "All tags"/"All
 * authors" reset chips (which pass `{ tag: undefined }` / `{ author:
 * undefined }`) a silent no-op.
 */
export function buildBlogChipHref(query: BlogChipHrefQuery, overrides: BlogChipHrefOverrides): string {
  const params = new URLSearchParams();
  const tag = "tag" in overrides ? overrides.tag : query.tag;
  const author = "author" in overrides ? overrides.author : query.author;
  if (tag) params.set("tag", tag);
  if (author) params.set("author", author);
  const qs = params.toString();
  return qs ? `/blog?${qs}` : "/blog";
}
