"use client";

import Image from "next/image";
import Link from "next/link";

import type { SearchSuggestionItem } from "@/services/search-extensions";

interface SearchSuggestionsDropdownProps {
  hasQuery: boolean;
  items: SearchSuggestionItem[];
  activeIndex: number;
  recentSearches: string[];
  onSelectItem: (item: SearchSuggestionItem) => void;
  onSelectRecent: (query: string) => void;
}

export function SearchSuggestionsDropdown({
  hasQuery,
  items,
  activeIndex,
  recentSearches,
  onSelectItem,
  onSelectRecent,
}: SearchSuggestionsDropdownProps) {
  if (!hasQuery) {
    return (
      <div className="mt-4">
        {recentSearches.length > 0 ? (
          <>
            <p className="text-caption font-medium text-charcoal/70">Recent searches</p>
            <ul className="mt-2 flex flex-col gap-1">
              {recentSearches.map((query) => (
                <li key={query}>
                  <button
                    type="button"
                    onClick={() => onSelectRecent(query)}
                    className="w-full rounded-md px-2 py-1.5 text-left text-small text-charcoal hover:bg-muted"
                  >
                    {query}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-small text-charcoal/70">Try: curry powder, coconut milk, chilli powder</p>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="mt-4 text-small text-charcoal/70">No matches yet — keep typing or press Enter to search.</p>
    );
  }

  const products = items.filter((item) => item.type === "Product");
  const recipes = items.filter((item) => item.type === "Recipe");

  return (
    <ul role="listbox" aria-label="Search suggestions" className="mt-4 flex flex-col gap-1">
      {products.length > 0 && (
        <li role="presentation" className="px-2 py-1 text-caption font-medium text-charcoal/70">
          Products
        </li>
      )}
      {products.map((item) => (
        <SuggestionRow
          key={item.id}
          item={item}
          isActive={items.indexOf(item) === activeIndex}
          onSelect={onSelectItem}
        />
      ))}
      {recipes.length > 0 && (
        <li role="presentation" className="px-2 py-1 text-caption font-medium text-charcoal/70">
          Recipes
        </li>
      )}
      {recipes.map((item) => (
        <SuggestionRow
          key={item.id}
          item={item}
          isActive={items.indexOf(item) === activeIndex}
          onSelect={onSelectItem}
        />
      ))}
    </ul>
  );
}

function SuggestionRow({
  item,
  isActive,
  onSelect,
}: {
  item: SearchSuggestionItem;
  isActive: boolean;
  onSelect: (item: SearchSuggestionItem) => void;
}) {
  return (
    <li role="option" aria-selected={isActive}>
      <Link
        href={item.href}
        onClick={() => onSelect(item)}
        className={
          isActive
            ? "flex items-center gap-3 rounded-md bg-muted px-2 py-1.5 text-small text-charcoal"
            : "flex items-center gap-3 rounded-md px-2 py-1.5 text-small text-charcoal hover:bg-muted"
        }
      >
        {item.imageSrc && (
          <span className="relative size-8 shrink-0 overflow-hidden rounded bg-cream">
            <Image src={item.imageSrc} alt="" fill sizes="32px" className="object-contain" />
          </span>
        )}
        <span>{item.label}</span>
      </Link>
    </li>
  );
}
