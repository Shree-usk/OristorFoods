"use client";

import { Button } from "@/components/ui/button";

interface RecipeEmptyStateProps {
  message: string;
  actionLabel: string;
  onAction: () => void;
}

export function RecipeEmptyState({ message, actionLabel, onAction }: RecipeEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-input py-16 text-center">
      <p className="text-body text-charcoal">{message}</p>
      <Button type="button" variant="outline" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}
