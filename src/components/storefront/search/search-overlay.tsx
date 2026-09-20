"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { Search } from "lucide-react";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useSearchSuggestions } from "@/hooks/use-search-suggestions";
import { useRecentSearchesStore } from "@/lib/stores/recent-searches-store";
import type { SearchSuggestionItem } from "@/services/search-extensions";
import type { ImageSource } from "@/types/home";
import { SearchInput } from "./search-input";
import { SearchSuggestionsDropdown } from "./search-suggestions";

const DEBOUNCE_MS = 275;

export function SearchOverlay() {
  const router = useRouter();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [rawQuery, setRawQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  const debouncedQuery = useDebouncedValue(rawQuery, DEBOUNCE_MS);
  const trimmedQuery = debouncedQuery.trim();
  const { data: suggestions } = useSearchSuggestions(trimmedQuery);

  const recentSearches = useRecentSearchesStore((state) => state.queries);
  const addRecentSearch = useRecentSearchesStore((state) => state.add);

  const items: SearchSuggestionItem[] = trimmedQuery
    ? [...(suggestions?.products.map(toSuggestionItem) ?? []), ...(suggestions?.recipes ?? [])]
    : [];

  function reset() {
    setRawQuery("");
    setActiveIndex(-1);
  }

  function recordAndClose(query: string) {
    const trimmed = query.trim();
    if (trimmed) addRecentSearch(trimmed);
    setOpen(false);
    reset();
  }

  function handleSelectItem(item: SearchSuggestionItem) {
    // Records what was actually selected, not the (possibly partial) typed
    // text — matches handleSubmit's activeIndex branch below.
    recordAndClose(item.label);
  }

  function handleSelectRecent(query: string) {
    recordAndClose(query);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeIndex >= 0 && items[activeIndex]) {
      const item = items[activeIndex];
      recordAndClose(item.label);
      router.push(item.href);
      return;
    }
    const trimmed = rawQuery.trim();
    if (!trimmed) return;
    recordAndClose(trimmed);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && items.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, items.length - 1));
    } else if (event.key === "ArrowUp" && items.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, -1));
    } else if (event.key === "Escape") {
      // Explicit reset alongside setOpen(false) — belt-and-suspenders so
      // "close on Escape" doesn't rely solely on Base UI's own
      // escape-to-dismiss handling also firing onOpenChange(false) (which
      // calls reset() below).
      setOpen(false);
      reset();
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogTrigger
        aria-label="Search"
        className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Search className="size-5" aria-hidden="true" />
      </DialogTrigger>
      <DialogContent aria-label="Search Oristor" className="top-20 max-w-xl translate-y-0">
        <form role="search" aria-label="Site" onSubmit={handleSubmit}>
          <SearchInput
            id={inputId}
            value={rawQuery}
            onChange={(value) => {
              setRawQuery(value);
              setActiveIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </form>
        <div aria-live="polite" className="sr-only">
          {trimmedQuery && `${items.length} result${items.length === 1 ? "" : "s"} found`}
        </div>
        <SearchSuggestionsDropdown
          hasQuery={trimmedQuery.length > 0}
          items={items}
          activeIndex={activeIndex}
          recentSearches={recentSearches}
          onSelectItem={handleSelectItem}
          onSelectRecent={handleSelectRecent}
        />
      </DialogContent>
    </Dialog>
  );
}

function toSuggestionItem(product: {
  id: string;
  name: string;
  href: string;
  imageSrc: ImageSource;
}): SearchSuggestionItem {
  // ProductListItem.imageSrc is ImageSource (StaticImageData | string) since
  // it's shared with statically-imported homepage fixtures; real catalogue
  // products always resolve to a URL string, but narrow defensively here
  // since SearchSuggestionItem.imageSrc is string-only.
  const imageSrc = typeof product.imageSrc === "string" ? product.imageSrc : product.imageSrc.src;
  return {
    id: product.id,
    label: product.name,
    href: product.href,
    imageSrc: imageSrc || undefined,
    type: "Product",
  };
}
