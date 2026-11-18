"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchAdminProduct, fetchAdminProducts } from "@/lib/api/admin-product-client";

interface FoodAcademyProductPickerProps {
  productIds: string[];
  onChange: (productIds: string[]) => void;
}

/**
 * Multi-select for the "Products used" cross-links on a Food Academy
 * entry — same shape as FoodAcademyRecipePicker, reusing the existing
 * admin products list/search endpoint.
 */
export function FoodAcademyProductPicker({ productIds, onChange }: FoodAcademyProductPickerProps) {
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const missing = productIds.filter((id) => !(id in labels));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map((id) => fetchAdminProduct(id).then((product) => [id, product.name] as const).catch(() => [id, id] as const))).then((pairs) => {
      if (cancelled) return;
      setLabels((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `labels` is read, not a dependency: including it would refetch on every resolved label.
  }, [productIds]);

  const { data } = useQuery({
    queryKey: ["admin-food-academy-product-search", search],
    queryFn: () => fetchAdminProducts({ page: 1, pageSize: 8, search: search || undefined }),
    enabled: open,
  });

  function remove(id: string) {
    onChange(productIds.filter((existing) => existing !== id));
  }

  function add(id: string, name: string) {
    if (!productIds.includes(id)) onChange([...productIds, id]);
    setLabels((prev) => ({ ...prev, [id]: name }));
    setOpen(false);
    setSearch("");
  }

  return (
    <div className="space-y-2">
      {productIds.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {productIds.map((id) => (
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
          Add product
        </Button>
        {open && (
          <div className="absolute top-full left-0 z-10 mt-1 w-64 rounded-lg border border-input bg-background p-2 shadow-md">
            <Input placeholder="Search products…" value={search} onChange={(event) => setSearch(event.target.value)} autoFocus />
            <ul className="mt-2 max-h-48 overflow-y-auto">
              {(data?.items ?? [])
                .filter((product) => !productIds.includes(product.id))
                .map((product) => (
                  <li key={product.id}>
                    <button type="button" className="w-full rounded px-2 py-1 text-left text-small hover:bg-muted" onClick={() => add(product.id, product.name)}>
                      {product.name}
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
