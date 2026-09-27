"use client";

import { Bookmark } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useRecipeBookmark } from "@/hooks/use-recipe-bookmark";
import { cn } from "@/lib/utils";

interface RecipeBookmarkButtonProps {
  recipeId: string;
  recipeSlug: string;
  /** "icon": the RecipeCard corner toggle (STORY-017 grid). "labelled": the detail page's button with visible text. */
  variant?: "icon" | "labelled";
  className?: string;
}

/**
 * Client Component, optimistic toggle (STORY-022). Kept isolated so RecipeCard,
 * which renders it, can stay a Server Component — Next.js lets a Server
 * Component render a Client Component child without becoming one itself.
 * This is a deliberate improvement over the ProductCard precedent, where
 * the whole card had to become a Client Component to call useWishlist
 * directly.
 */
export function RecipeBookmarkButton({ recipeId, recipeSlug, variant = "icon", className }: RecipeBookmarkButtonProps) {
  const bookmark = useRecipeBookmark(recipeId, recipeSlug);
  const label = bookmark.isBookmarked ? "Remove bookmark" : "Bookmark this recipe";

  if (variant === "labelled") {
    return (
      <Button
        type="button"
        variant="outline"
        disabled={!bookmark.isAvailable}
        aria-pressed={bookmark.isBookmarked}
        onClick={() => bookmark.toggle()}
        className={cn("gap-2", className)}
      >
        <Bookmark className={cn("size-4", bookmark.isBookmarked && "fill-current")} aria-hidden="true" />
        {label}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={!bookmark.isAvailable}
      aria-pressed={bookmark.isBookmarked}
      aria-label={label}
      className={cn(
        "absolute top-2 right-2 z-10 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background",
        className,
      )}
      onClick={(event) => {
        // RecipeCard's title Link stretches an invisible ::after overlay
        // over the whole <article> (the same CSS trick ProductCard's own
        // wrapping <Link> uses) — without these two calls, a click here
        // would also navigate to the recipe instead of only toggling the
        // bookmark.
        event.preventDefault();
        event.stopPropagation();
        bookmark.toggle();
      }}
    >
      <Bookmark className={bookmark.isBookmarked ? "fill-current" : undefined} aria-hidden="true" />
    </Button>
  );
}
