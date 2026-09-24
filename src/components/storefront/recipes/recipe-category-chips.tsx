"use client";

import Link from "next/link";
import type { MouseEvent } from "react";

import { cn } from "@/lib/utils";
import type { RecipeFacetOption } from "@/types/recipe";

interface RecipeCategoryChipsProps {
  categories: RecipeFacetOption[];
  selected: string | null;
  hrefFor: (slug: string | null) => string;
  onSelect: (slug: string | null) => void;
}

/**
 * Real links (crawlable, open-in-new-tab works), but a plain click updates
 * the URL state in place instead of a full navigation.
 */
export function RecipeCategoryChips({ categories, selected, hrefFor, onSelect }: RecipeCategoryChipsProps) {
  const chips: Array<{ slug: string | null; name: string }> = [{ slug: null, name: "All" }, ...categories];

  function handleClick(event: MouseEvent<HTMLAnchorElement>, slug: string | null) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSelect(slug);
  }

  return (
    <nav aria-label="Recipe categories">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
        {chips.map((chip) => {
          const isSelected = chip.slug === selected;
          return (
            <li key={chip.slug ?? "all"} className="shrink-0">
              <Link
                href={hrefFor(chip.slug)}
                onClick={(event) => handleClick(event, chip.slug)}
                aria-current={isSelected ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-4 text-small transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-charcoal hover:bg-muted",
                )}
              >
                {chip.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
