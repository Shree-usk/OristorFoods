"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchAdminRecipe, fetchAdminRecipes } from "@/lib/api/admin-recipe-client";

interface FoodAcademyRecipePickerProps {
  recipeIds: string[];
  onChange: (recipeIds: string[]) => void;
}

/**
 * Multi-select for the "Recipes to try" cross-links on a Food Academy
 * entry. Reuses the existing admin recipes list/search endpoint (same
 * precedent as RecipeIngredientProductPicker) rather than a new
 * reference-data list — recipes are too numerous to bulk-load.
 */
export function FoodAcademyRecipePicker({ recipeIds, onChange }: FoodAcademyRecipePickerProps) {
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Resolve display titles for already-linked ids (the entry detail API
  // only returns raw ids by design — see food-academy.repository.ts's
  // comment on recipeRefs/productRefs).
  useEffect(() => {
    const missing = recipeIds.filter((id) => !(id in labels));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map((id) => fetchAdminRecipe(id).then((recipe) => [id, recipe.title] as const).catch(() => [id, id] as const))).then((pairs) => {
      if (cancelled) return;
      setLabels((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `labels` is read, not a dependency: including it would refetch on every resolved label.
  }, [recipeIds]);

  const { data } = useQuery({
    queryKey: ["admin-food-academy-recipe-search", search],
    queryFn: () => fetchAdminRecipes({ page: 1, pageSize: 8, search: search || undefined }),
    enabled: open,
  });

  function remove(id: string) {
    onChange(recipeIds.filter((existing) => existing !== id));
  }

  function add(id: string, title: string) {
    if (!recipeIds.includes(id)) onChange([...recipeIds, id]);
    setLabels((prev) => ({ ...prev, [id]: title }));
    setOpen(false);
    setSearch("");
  }

  return (
    <div className="space-y-2">
      {recipeIds.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {recipeIds.map((id) => (
            <li key={id} className="flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-small text-charcoal">
              {labels[id] ?? id}
              <button type="button" onClick={() => remove(id)} aria-label={`Remove ${labels[id] ?? id}`} className="text-muted-foreground hover:text-destructive">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative w-fit">
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen((current) => !current)}>
          Add recipe
        </Button>
        {open && (
          <div className="absolute top-full left-0 z-10 mt-1 w-64 rounded-lg border border-input bg-background p-2 shadow-md">
            <Input placeholder="Search recipes…" value={search} onChange={(event) => setSearch(event.target.value)} autoFocus />
            <ul className="mt-2 max-h-48 overflow-y-auto">
              {(data?.items ?? [])
                .filter((recipe) => !recipeIds.includes(recipe.id))
                .map((recipe) => (
                  <li key={recipe.id}>
                    <button type="button" className="w-full rounded px-2 py-1 text-left text-small hover:bg-muted" onClick={() => add(recipe.id, recipe.title)}>
                      {recipe.title}
                    </button>
                  </li>
                ))}
              {data?.items.length === 0 && <li className="px-2 py-1 text-small text-charcoal/60">No matches.</li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
