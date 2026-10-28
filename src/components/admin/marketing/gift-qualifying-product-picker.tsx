"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchAdminProduct, fetchAdminProducts } from "@/lib/api/admin-product-client";

export interface PickedProduct {
  id: string;
  name: string;
  variantId?: string | null;
  variantName?: string | null;
}

interface GiftQualifyingProductPickerProps {
  value: PickedProduct | null;
  onChange: (product: PickedProduct) => void;
  disabled?: boolean;
}

/**
 * Single-select product picker for GiftOffer's qualifying-product field —
 * same search-dropdown mechanics as bundle-component-picker.tsx's own
 * product step, collapsed to single-select. Includes an inline variant
 * sub-step (same productForVariantStep pattern as BundleComponentPicker)
 * so an offer can optionally be pinned to one specific size of the
 * qualifying product — null/unset means any variant qualifies, the
 * original behavior before this pin existed.
 * Unlike BundleComponentPicker's "add another component" button, this
 * shows the currently-selected product (and pinned variant, if any)
 * persistently, since the field is required and singular, not a growable
 * list.
 */
export function GiftQualifyingProductPicker({ value, onChange, disabled }: GiftQualifyingProductPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [productForVariantStep, setProductForVariantStep] = useState<{ id: string; name: string } | null>(null);

  const { data } = useQuery({
    queryKey: ["admin-gift-qualifying-product-search", search],
    queryFn: () => fetchAdminProducts({ page: 1, pageSize: 8, search: search || undefined }),
    enabled: open,
  });

  const { data: productDetail } = useQuery({
    queryKey: ["admin-product", productForVariantStep?.id],
    queryFn: () => fetchAdminProduct(productForVariantStep!.id),
    enabled: productForVariantStep !== null,
  });

  function close() {
    setOpen(false);
    setSearch("");
    setProductForVariantStep(null);
  }

  if (productForVariantStep) {
    const variants: { id: string; name: string }[] = productDetail?.variants ?? [];
    return (
      <div className="relative">
        <Button type="button" size="sm" variant="outline" disabled>
          {productForVariantStep.name}
        </Button>
        <div className="absolute top-full left-0 z-10 mt-1 w-72 rounded-lg border border-input bg-background p-3 shadow-md">
          <p className="text-small font-medium text-charcoal">{productForVariantStep.name}</p>
          <p className="mt-1 text-caption text-charcoal/60">Pin this offer to one size, or let any size qualify.</p>
          <div className="mt-2 flex flex-col gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="justify-start"
              onClick={() => {
                onChange({ id: productForVariantStep.id, name: productForVariantStep.name, variantId: null, variantName: null });
                close();
              }}
            >
              Any size qualifies
            </Button>
            {variants.map((variant) => (
              <Button
                key={variant.id}
                type="button"
                size="sm"
                variant="outline"
                className="justify-start"
                onClick={() => {
                  onChange({ id: productForVariantStep.id, name: productForVariantStep.name, variantId: variant.id, variantName: variant.name });
                  close();
                }}
              >
                {variant.name}
              </Button>
            ))}
          </div>
          <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => setOpen((current) => !current)}>
        {value ? `Change product (${value.name}${value.variantId ? ` — ${value.variantName}` : ""})` : "Choose product"}
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
                  onClick={() => setProductForVariantStep({ id: product.id, name: product.name })}
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
