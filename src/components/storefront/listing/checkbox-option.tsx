"use client";

import { useId } from "react";

import { Checkbox } from "@/components/ui/checkbox";

interface CheckboxOptionProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/**
 * Checkbox + visible label. aria-labelledby points at the text span, not the
 * wrapping <label>: Base UI otherwise falls back to the enclosing label, which
 * contains the checkbox itself, and that self-reference resolves to an empty
 * accessible name (axe aria-toggle-field-name). The <label> wrapper stays so
 * clicking the text still toggles the checkbox.
 */
export function CheckboxOption({ label, checked, onCheckedChange }: CheckboxOptionProps) {
  const labelId = useId();
  return (
    <label className="flex items-center gap-2 text-small text-charcoal">
      <Checkbox checked={checked} onCheckedChange={onCheckedChange} aria-labelledby={labelId} />
      <span id={labelId}>{label}</span>
    </label>
  );
}
