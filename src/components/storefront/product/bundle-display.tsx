"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAddBundleToCart } from "@/hooks/use-add-bundle-to-cart";
import type { ProductDetailBundle, ProductDetailBundleItem } from "@/services/product.service";

interface BundleDisplayProps {
  bundle: ProductDetailBundle;
  items: ProductDetailBundleItem[];
}

interface PreviewResult {
  discountedTotal: string;
  standaloneTotal: string;
}

/**
 * Replaces the PDP's old static "N x Name" bundle list. Fixed: shows the
 * locked contents and one add-to-cart button, priced server-side at page
 * load (nothing to select, so no live recompute needed). Selectable/
 * MixAndMatch: lets the customer pick quantities per eligible component
 * within each item's own and the bundle's own min/max, re-pricing via the
 * public preview endpoint on every change (debounced) rather than purely
 * client-side math — the server is always the source of truth for price.
 */
function BundleEyebrow() {
  return (
    <span className="inline-flex items-center rounded-full bg-gold-light px-3 py-1 text-caption font-medium uppercase tracking-wide text-charcoal/70">
      Meal Bundle
    </span>
  );
}

export function BundleDisplay({ bundle, items }: BundleDisplayProps) {
  const { addBundleToCart, isAdding, error } = useAddBundleToCart(bundle.id);

  if (bundle.bundleType === "Fixed") {
    return (
      <div className="rounded-lg border border-input p-4">
        <BundleEyebrow />
        <h2 className="mt-1 text-h4 font-heading text-charcoal">{bundle.name}</h2>
        {bundle.description && <p className="mt-1 text-small text-charcoal/70">{bundle.description}</p>}
        <ul className="mt-3 space-y-1 text-small text-charcoal">
          {items.filter((item) => item.isRequired).map((item) => (
            <li key={item.bundleItemId}>
              {item.quantity} x {item.name}
              {!item.inStock && <span className="ml-1 text-destructive">(out of stock)</span>}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center gap-2 font-number text-h4 text-charcoal">
          <span>{bundle.currency} {bundle.discountedTotal.toLocaleString()}</span>
          {bundle.discountedTotal < bundle.standaloneTotal && (
            <span className="text-body text-charcoal/50 line-through">{bundle.currency} {bundle.standaloneTotal.toLocaleString()}</span>
          )}
        </div>
        {error && <p className="mt-2 text-small text-destructive">{error}</p>}
        <Button type="button" className="mt-3" disabled={isAdding || !bundle.inStock} onClick={() => addBundleToCart(null)}>
          {bundle.inStock ? "Add bundle to cart" : "Currently unavailable"}
        </Button>
      </div>
    );
  }

  return <SelectableBundleDisplay bundle={bundle} items={items} addBundleToCart={addBundleToCart} isAdding={isAdding} error={error} />;
}

function SelectableBundleDisplay({
  bundle,
  items,
  addBundleToCart,
  isAdding,
  error,
}: BundleDisplayProps & { addBundleToCart: (selections: { bundleItemId: string; quantity: number }[]) => void; isAdding: boolean; error: string | null }) {
  const [quantityByItemId, setQuantityByItemId] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const selections = useMemo(
    () => Object.entries(quantityByItemId).filter(([, quantity]) => quantity > 0).map(([bundleItemId, quantity]) => ({ bundleItemId, quantity })),
    [quantityByItemId],
  );
  const totalSelected = selections.reduce((sum, selection) => sum + selection.quantity, 0);

  useEffect(() => {
    // No synchronous setState here when selections is empty — `displayedPreview`
    // below derives the "nothing selected" display instead, so stale preview
    // state is simply never read rather than eagerly cleared.
    if (selections.length === 0) return;
    const timeout = setTimeout(() => {
      setPreviewLoading(true);
      fetch(`/api/bundles/${bundle.id}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selections }),
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((result: PreviewResult | null) => setPreview(result))
        .catch(() => setPreview(null))
        .finally(() => setPreviewLoading(false));
    }, 400);
    return () => clearTimeout(timeout);
    // Keyed on the serialized selection (stable across re-renders with the
    // same content) rather than `selections` itself, which is a fresh array
    // from useMemo every time quantityByItemId changes shape.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(selections), bundle.id]);

  function setQuantity(itemId: string, quantity: number) {
    setQuantityByItemId((prev) => ({ ...prev, [itemId]: quantity }));
  }

  const belowMin = bundle.minQuantity !== null && totalSelected < bundle.minQuantity;
  const aboveMax = bundle.maxQuantity !== null && totalSelected > bundle.maxQuantity;
  const canAdd = totalSelected > 0 && !belowMin && !aboveMax;
  // Derived, not synced via setState-in-effect: once every item is
  // deselected there is nothing to preview, regardless of whatever the
  // last fetch happened to resolve with.
  const displayedPreview = selections.length > 0 ? preview : null;

  return (
    <div className="rounded-lg border border-input p-4">
      <BundleEyebrow />
      <h2 className="mt-1 text-h4 font-heading text-charcoal">{bundle.name}</h2>
      {bundle.description && <p className="mt-1 text-small text-charcoal/70">{bundle.description}</p>}

      <div className="mt-3 flex flex-col gap-2">
        {items.map((item) => {
          const quantity = quantityByItemId[item.bundleItemId] ?? 0;
          const max = item.maxQuantity ?? undefined;
          return (
            <div key={item.bundleItemId} className="flex items-center justify-between gap-3 rounded-md border border-input px-3 py-2">
              <div>
                <p className="text-small font-medium text-charcoal">{item.name}</p>
                <p className="text-caption text-charcoal/60">
                  {item.price.toLocaleString()} each{!item.inStock && " · out of stock"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="icon-sm" variant="outline" disabled={quantity <= 0 || !item.inStock} onClick={() => setQuantity(item.bundleItemId, quantity - 1)}>
                  −
                </Button>
                <span className="w-6 text-center font-number">{quantity}</span>
                <Button type="button" size="icon-sm" variant="outline" disabled={!item.inStock || (max !== undefined && quantity >= max)} onClick={() => setQuantity(item.bundleItemId, quantity + 1)}>
                  +
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-small text-charcoal/70">
        {totalSelected} selected
        {bundle.minQuantity !== null && ` · min ${bundle.minQuantity}`}
        {bundle.maxQuantity !== null && `, max ${bundle.maxQuantity}`}
      </p>

      {displayedPreview && (
        <div className="mt-2 flex items-center gap-2 font-number text-h4 text-charcoal">
          <span>{bundle.currency} {Number(displayedPreview.discountedTotal).toLocaleString()}</span>
          {Number(displayedPreview.discountedTotal) < Number(displayedPreview.standaloneTotal) && (
            <span className="text-body text-charcoal/50 line-through">{bundle.currency} {Number(displayedPreview.standaloneTotal).toLocaleString()}</span>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-small text-destructive">{error}</p>}
      <Button type="button" className="mt-3" disabled={!canAdd || isAdding || previewLoading} onClick={() => addBundleToCart(selections)}>
        Add bundle to cart
      </Button>
    </div>
  );
}
