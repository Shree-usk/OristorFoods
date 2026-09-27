import { MarkdownContent } from "@/components/shared/markdown-content";
import { RecipeCard } from "@/components/storefront/recipes/recipe-card";
import { VideoPlayer } from "@/components/storefront/recipes/video-player";
import { normalizeVideoUrl } from "@/lib/video-url";
import type { BlogBodyBlock } from "@/lib/blog-body-blocks";
import type { RecipeCard as RecipeCardData } from "@/types/recipe";

interface BlogPostBodyProps {
  blocks: BlogBodyBlock[];
  /** Only Published recipes ever appear here — resolved by the service layer. */
  recipeCards: Record<string, RecipeCardData>;
  /** Fallback poster for any [[video:...]] embed in this post; a video embed
   *  is silently omitted when this is null, since there is no per-embed
   *  thumbnail source without admin-authored media (Epic 07). */
  videoPosterUrl: string | null;
  videoPosterAlt: string;
}

export function BlogPostBody({ blocks, recipeCards, videoPosterUrl, videoPosterAlt }: BlogPostBodyProps) {
  return (
    <div className="max-w-2xl">
      {blocks.map((block, index) => {
        if (block.kind === "markdown") {
          return <MarkdownContent key={index} content={block.content} />;
        }
        if (block.kind === "recipeEmbed") {
          const recipe = recipeCards[block.slug];
          if (!recipe) return null;
          return (
            <div key={index} className="not-prose my-6 max-w-sm">
              <RecipeCard recipe={recipe} headingLevel="h3" />
            </div>
          );
        }
        // block.kind === "videoEmbed"
        const normalized = normalizeVideoUrl(block.url);
        if (!normalized || !videoPosterUrl) return null;
        return (
          <div key={index} className="my-6">
            <VideoPlayer
              video={{ url: normalized.url, provider: normalized.provider }}
              posterUrl={videoPosterUrl}
              posterAlt={videoPosterAlt}
            />
          </div>
        );
      })}
    </div>
  );
}
