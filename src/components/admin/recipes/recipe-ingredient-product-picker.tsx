"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchAdminProducts } from "@/lib/api/admin-product-client";

interface RecipeIngredientProductPickerProps {
  value: string | null | undefined;
  onChange: (productId: string | undefined) => void;
}

/**
 * "Shop this ingredient" (AC) — reuses the existing admin products
 * list/search endpoint (STORY-040) rather than building a new
 * reference-data list; products are too numerous to bulk-load like
 * categories/dietary tags.
 */
export function RecipeIngredientProductPicker({ value, onChange }: RecipeIngredientProductPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data } = useQuery({
    queryKey: ["admin-recipe-ingredient-product-search", search],
    queryFn: () => fetchAdminProducts({ page: 1, pageSize: 8, search: search || undefined }),
    enabled: open,
  });

  if (value) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => onChange(undefined)}>
        Unlink product
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen((current) => !current)}>
        Link product
      </Button>
      {open && (
        <div className="absolute top-full right-0 z-10 mt-1 w-64 rounded-lg border border-input bg-background p-2 shadow-md">
          <Input placeholder="Search products…" value={search} onChange={(event) => setSearch(event.target.value)} autoFocus />
          <ul className="mt-2 max-h-48 overflow-y-auto">
            {(data?.items ?? []).map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1 text-left text-small hover:bg-muted"
                  onClick={() => {
                    onChange(product.id);
                    setOpen(false);
                  }}
                >
                  {product.name}
                </button>
              </li>
            ))}
            {data?.items.length === 0 && <li className="px-2 py-1 text-small text-charcoal/60">No matches.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
