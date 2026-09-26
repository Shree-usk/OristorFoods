export type BlogBodyBlock =
  | { kind: "markdown"; content: string }
  | { kind: "recipeEmbed"; slug: string }
  | { kind: "videoEmbed"; url: string };

const RECIPE_EMBED_PATTERN = /^\[\[recipe:(.+)\]\]$/;
const VIDEO_EMBED_PATTERN = /^\[\[video:(.+)\]\]$/;

/**
 * Splits raw blog markdown into alternating markdown/embed blocks on blank
 * lines. A block is an embed only when the ENTIRE block (after trimming) is
 * exactly `[[recipe:slug]]` or `[[video:url]]` — an embed-like token
 * appearing mid-paragraph is left as ordinary markdown text, never
 * mistaken for a block-level embed. `<MarkdownContent>` itself is never
 * touched: the caller (BlogPostBody) hands each markdown block to it
 * unmodified.
 */
export function parseBodyBlocks(content: string): BlogBodyBlock[] {
  const rawBlocks = content.split(/\n\s*\n/).map((block) => block.trim()).filter((block) => block.length > 0);

  const blocks = rawBlocks.map((block): BlogBodyBlock => {
    const recipeMatch = block.match(RECIPE_EMBED_PATTERN);
    if (recipeMatch) return { kind: "recipeEmbed", slug: recipeMatch[1] };
    const videoMatch = block.match(VIDEO_EMBED_PATTERN);
    if (videoMatch) return { kind: "videoEmbed", url: videoMatch[1] };
    return { kind: "markdown", content: block };
  });

  // Adjacent markdown blocks (i.e. blank-line-separated paragraphs with no
  // embed between them) are re-joined into a single markdown block so that
  // `<MarkdownContent>` still receives whole, unfragmented markdown — an
  // embed line only ever splits markdown apart when it actually sits
  // between two markdown chunks.
  const merged: BlogBodyBlock[] = [];
  for (const block of blocks) {
    const last = merged[merged.length - 1];
    if (block.kind === "markdown" && last?.kind === "markdown") {
      last.content = `${last.content}\n\n${block.content}`;
    } else {
      merged.push(block);
    }
  }
  return merged;
}
