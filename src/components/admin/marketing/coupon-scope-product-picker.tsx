"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchAdminProduct, fetchAdminProducts } from "@/lib/api/admin-product-client";

interface CouponScopeProductPickerProps {
  value: string[];
  onChange: (productIds: string[]) => void;
}

/**
 * STORY-050b. Multi-select product picker for a coupon/promotion's
 * scope — reuses the existing admin products search endpoint
 * (STORY-040) rather than bulk-loading every product, the same
 * dependency recipe-ingredient-product-picker.tsx (STORY-043) already
 * uses for its single-select variant; this one keeps a running
 * selection instead of replacing a single value.
 */
export function CouponScopeProductPicker({ value, onChange }: CouponScopeProductPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data } = useQuery({
    queryKey: ["admin-coupon-scope-product-search", search],
    queryFn: () => fetchAdminProducts({ page: 1, pageSize: 8, search: search || undefined }),
    enabled: open,
  });

  // Resolves display names for already-selected products even when they're off the current search page.
  const { data: selectedProducts } = useQuery({
    queryKey: ["admin-coupon-scope-product-names", value],
    queryFn: () => Promise.all(value.map((id) => fetchAdminProduct(id))),
    enabled: value.length > 0,
  });

  const selected = new Map([...(data?.items ?? []).map((product) => [product.id, product.name] as const), ...(selectedProducts ?? []).map((product) => [product.id, product.name] as const)]);

  function add(productId: string) {
    if (!value.includes(productId)) onChange([...value, productId]);
    setOpen(false);
    setSearch("");
  }

  function remove(productId: string) {
    onChange(value.filter((id) => id !== productId));
  }

  return (
    <div>
      <ul className="flex flex-wrap gap-2">
        {value.map((productId) => (
          <li key={productId} className="flex items-center gap-1 rounded-full border border-input bg-muted px-2 py-1 text-small text-charcoal">
            {selected.get(productId) ?? productId}
            <button type="button" aria-label="Remove product" className="text-charcoal/60 hover:text-charcoal" onClick={() => remove(productId)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="relative mt-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen((current) => !current)}>
          Add product
        </Button>
        {open && (
          <div className="absolute top-full left-0 z-10 mt-1 w-64 rounded-lg border border-input bg-background p-2 shadow-md">
            <Input placeholder="Search products…" value={search} onChange={(event) => setSearch(event.target.value)} autoFocus />
            <ul className="mt-2 max-h-48 overflow-y-auto">
              {(data?.items ?? []).map((product) => (
                <li key={product.id}>
                  <button type="button" className="w-full rounded px-2 py-1 text-left text-small hover:bg-muted" onClick={() => add(product.id)}>
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
