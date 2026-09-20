"use client";

import { Search } from "lucide-react";
import type { ChangeEvent, KeyboardEvent } from "react";

interface SearchInputProps {
  id: string;
  /** Set when used inside a native `<form method="get">` (the /search page) so submission serializes this field. */
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
  placeholder?: string;
}

export function SearchInput({
  id,
  name,
  value,
  defaultValue,
  onChange,
  onKeyDown,
  autoFocus,
  placeholder = "Search products and recipes",
}: SearchInputProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange?.(event.target.value);
  }

  return (
    <div className="relative flex flex-1 items-center">
      <Search className="pointer-events-none absolute left-3 size-4 text-stone" aria-hidden="true" />
      <input
        id={id}
        name={name}
        type="search"
        value={value}
        defaultValue={defaultValue}
        onChange={onChange ? handleChange : undefined}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        placeholder={placeholder}
        autoComplete="off"
        aria-label="Search"
        className="h-11 w-full rounded-lg border border-border bg-background py-2 pr-3 pl-9 text-body text-charcoal placeholder:text-stone focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      />
    </div>
  );
}
