"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const MIN_SERVINGS = 1;
const MAX_SERVINGS = 50;

interface ServingSizeAdjusterProps {
  servings: number;
  onChange: (servings: number) => void;
}

export function ServingSizeAdjuster({ servings, onChange }: ServingSizeAdjusterProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-small text-charcoal/70">Servings</span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Decrease servings"
          disabled={servings <= MIN_SERVINGS}
          onClick={() => onChange(Math.max(MIN_SERVINGS, servings - 1))}
        >
          <Minus />
        </Button>
        <span className="w-6 text-center font-number text-body" aria-live="polite">
          {servings}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Increase servings"
          disabled={servings >= MAX_SERVINGS}
          onClick={() => onChange(Math.min(MAX_SERVINGS, servings + 1))}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}
