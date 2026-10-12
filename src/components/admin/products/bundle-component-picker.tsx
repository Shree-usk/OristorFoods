"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchAdminProduct, fetchAdminProducts } from "@/lib/api/admin-product-client";

interface BundleComponentPickerProps {
  /** Confirms a (productId, variantId) pair — variantId null means "the whole product". */
  onSelect: (componentProductId: string, componentVariantId: string | null) => void;
}

/**
 * Admin data-entry aid for picking a bundle component: product search
 * (reusing recipe-ingredient-product-picker.tsx's exact search-dropdown
 * pattern), then an optional second step offering that product's own
 * variants. No product-then-variant picker existed anywhere in this
 * codebase before this story — confirmed via a dedicated investigation
 * pass. This is purely an admin aid, not reused as a live customer-facing
 * drill-down (the storefront's own bundle-display.tsx lists each eligible
 * (product, variant) pair as its own flat, pre-approved option instead).
 */
export function BundleComponentPicker({ onSelect }: BundleComponentPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [productForVariantStep, setProductForVariantStep] = useState<{ id: string; name: string } | null>(null);

  const { data } = useQuery({
    queryKey: ["admin-bundle-component-product-search", search],
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
      <div className="absolute top-full right-0 z-10 mt-1 w-72 rounded-lg border border-input bg-background p-3 shadow-md">
        <p className="text-small font-medium text-charcoal">{productForVariantStep.name}</p>
        <p className="mt-1 text-caption text-charcoal/60">Pick a size, or add the whole product.</p>
        <div className="mt-2 flex flex-col gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="justify-start"
            onClick={() => {
              onSelect(productForVariantStep.id, null);
              close();
            }}
          >
            Whole product
          </Button>
          {variants.map((variant) => (
            <Button
              key={variant.id}
              type="button"
              size="sm"
              variant="outline"
              className="justify-start"
              onClick={() => {
                onSelect(productForVariantStep.id, variant.id);
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
    );
  }

  return (
    <div className="relative">
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen((current) => !current)}>
        Add component
      </Button>
      {open && (
        <div className="absolute top-full right-0 z-10 mt-1 w-72 rounded-lg border border-input bg-background p-2 shadow-md">
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
