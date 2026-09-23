"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface QaSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function QaSearch({ value, onChange }: QaSearchProps) {
  return (
    <div className="flex max-w-md flex-col gap-1">
      <Label htmlFor="qa-search">Search questions about this product</Label>
      <Input
        id="qa-search"
        type="search"
        maxLength={100}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
