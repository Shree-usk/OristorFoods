"use client";

import { useId } from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";

interface RecipeSearchBoxProps {
  value: string;
  /** Called on every keystroke; the listing debounces the fetch, not the input. */
  onChange: (value: string) => void;
}

export function RecipeSearchBox({ value, onChange }: RecipeSearchBoxProps) {
  const inputId = useId();

  return (
    <div role="search" className="relative w-full max-w-md">
      <label htmlFor={inputId} className="sr-only">
        Search recipes
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-charcoal/60"
        aria-hidden="true"
      />
      <Input
        id={inputId}
        type="search"
        value={value}
        maxLength={100}
        placeholder="Search recipes"
        onChange={(event) => onChange(event.target.value)}
        className="h-11 pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-charcoal/70 hover:bg-muted"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
