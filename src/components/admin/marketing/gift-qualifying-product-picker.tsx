"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchAdminProducts } from "@/lib/api/admin-product-client";

export interface PickedProduct {
  id: string;
  name: string;
}

interface GiftQualifyingProductPickerProps {
  value: PickedProduct | null;
  onChange: (product: PickedProduct) => void;
  disabled?: boolean;
}

/**
 * Single-select product picker for GiftOffer's qualifying-product field —
 * same search-dropdown mechanics as bundle-component-picker.tsx's own
 * product step, collapsed to single-select with no variant sub-step
 * (GiftOffer.productId has no variant pin, unlike its giftVariantId side,
 * which reuses BundleComponentPicker as-is instead of this component).
 * Unlike BundleComponentPicker's "add another component" button, this
 * shows the currently-selected product persistently, since the field is
 * required and singular, not a growable list.
 */
export function GiftQualifyingProductPicker({ value, onChange, disabled }: GiftQualifyingProductPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data } = useQuery({
    queryKey: ["admin-gift-qualifying-product-search", search],
    queryFn: () => fetchAdminProducts({ page: 1, pageSize: 8, search: search || undefined }),
    enabled: open,
  });

  function close() {
    setOpen(false);
    setSearch("");
  }

  return (
    <div className="relative">
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => setOpen((current) => !current)}>
        {value ? `Change product (${value.name})` : "Choose product"}
      </Button>
      {open && (
        <div className="absolute top-full left-0 z-10 mt-1 w-72 rounded-lg border border-input bg-background p-2 shadow-md">
          <Input placeholder="Search products…" value={search} onChange={(event) => setSearch(event.target.value)} autoFocus />
          <ul className="mt-2 max-h-48 overflow-y-auto">
            {(data?.items ?? []).map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1 text-left text-small hover:bg-muted"
                  onClick={() => {
                    onChange({ id: product.id, name: product.name });
                    close();
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
