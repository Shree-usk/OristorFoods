"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface SortOption<T extends string> {
  value: T;
  label: string;
  /** Shown as "<label> (coming soon)" and not selectable. */
  disabled?: boolean;
}

interface SortSelectProps<T extends string> {
  value: T;
  options: ReadonlyArray<SortOption<T>>;
  onValueChange: (value: T) => void;
  ariaLabel: string;
}

export function SortSelect<T extends string>({ value, options, onValueChange, ariaLabel }: SortSelectProps<T>) {
  const labelFor = (selected: T) => options.find((option) => option.value === selected)?.label ?? selected;

  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as T)}>
      <SelectTrigger aria-label={ariaLabel}>
        <SelectValue placeholder="Sort by">
          {(selected: T | null) => (selected ? labelFor(selected) : "Sort by")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.disabled ? `${option.label} (coming soon)` : option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
