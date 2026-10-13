"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PackagingSelector, type PackagingSelectionValue } from "@/components/storefront/product/packaging-selector";
import { ProductActions } from "@/components/storefront/product/product-actions";
import { VariantSelector } from "@/components/storefront/product/variant-selector";
import type { ProductDetailPackagingOption, ProductDetailVariant } from "@/services/product.service";

interface ProductPurchasePanelProps {
  productId: string;
  price: number;
  originalPrice: number | null;
  currency: string;
  inStock: boolean;
  rewardPoints: number;
  variants: ProductDetailVariant[];
  packagingOptions: ProductDetailPackagingOption[];
}

function defaultVariantId(variants: ProductDetailVariant[]): string | null {
  const firstAvailable = variants.find((variant) => variant.inStock && variant.stockQuantity > 0);
  return (firstAvailable ?? variants[0])?.id ?? null;
}

/**
 * Owns the one piece of client state a variant-driven PDP needs: which
 * size is selected. Price, stock message, and Add to Cart all live here
 * (not split across separate server-rendered blocks) specifically so
 * they can react together when the customer picks a different size —
 * the brief's "update the displayed product information when a variant
 * is selected" requirement. Renders identically to the old static PDP
 * block when the product has zero variants.
 */
export function ProductPurchasePanel({ productId, price, originalPrice, currency, inStock, rewardPoints, variants, packagingOptions }: ProductPurchasePanelProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(() => defaultVariantId(variants));
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) ?? null;

  // Story 3 (Custom Packaging). Reset directly in the variant-change
  // handler (a discrete user action), not via a useEffect watching
  // selectedVariantId — same "no effect/setState-sync" discipline
  // Story 2's React Compiler lint fix already established for this
  // codebase: a packaging option pinned to the old variant may no
  // longer apply to the new one.
  const [packagingSelection, setPackagingSelection] = useState<PackagingSelectionValue | null>(null);
  const [packagingAcknowledged, setPackagingAcknowledged] = useState(false);
  const [quantity, setQuantity] = useState(1);

  function handleSelectVariant(variantId: string) {
    setSelectedVariantId(variantId);
    setPackagingSelection(null);
    setPackagingAcknowledged(false);
    setQuantity(1);
  }

  // Export fulfilment flow. "The MOQ is to be selected automatically": picking
  // an option with a minimum quantity bumps the stepper straight to that
  // minimum (never down — a customer who already wants more keeps that
  // amount), and the stepper's own decrease button won't go below it while
  // the option stays selected.
  function handlePackagingChange(next: PackagingSelectionValue | null) {
    setPackagingSelection(next);
    const option = next?.optionId ? packagingOptions.find((entry) => entry.id === next.optionId) : null;
    if (option?.minQuantity && option.minQuantity > 1) {
      setQuantity((current) => Math.max(current, option.minQuantity!));
    }
  }

  const selectedPackagingOption = packagingSelection?.optionId ? packagingOptions.find((option) => option.id === packagingSelection.optionId) ?? null : null;
  const minAllowedQuantity = selectedPackagingOption?.minQuantity ?? 1;

  const displayPrice = selectedVariant ? (selectedVariant.promoPrice ?? selectedVariant.price) : price;
  const displayOriginalPrice = selectedVariant?.promoPrice ? selectedVariant.price : originalPrice;
  const displayCurrency = selectedVariant?.currency ?? currency;
  const displayInStock = selectedVariant ? selectedVariant.inStock && selectedVariant.stockQuantity > 0 : inStock;

  const packagingRequiresAcknowledgement = Boolean(packagingSelection?.optionId) && !packagingAcknowledged;

  return (
    <div>
      <div className="flex items-center gap-2 font-number text-h3 text-charcoal">
        <span>
          {displayCurrency} {displayPrice.toLocaleString()}
        </span>
        {displayOriginalPrice && (
          <span className="text-body text-charcoal/50 line-through">
            {displayCurrency} {displayOriginalPrice.toLocaleString()}
          </span>
        )}
      </div>
      <p className="mt-1 text-caption text-charcoal/70">Earn {rewardPoints} reward points with this purchase</p>
      <p className="mt-1 text-small text-charcoal/70">{displayInStock ? "In stock" : "Currently out of stock"}</p>

      <VariantSelector variants={variants} selectedVariantId={selectedVariantId} onSelect={handleSelectVariant} />

      <PackagingSelector
        options={packagingOptions}
        selectedVariantId={selectedVariantId}
        currency={displayCurrency}
        value={packagingSelection}
        onChange={handlePackagingChange}
        acknowledged={packagingAcknowledged}
        onAcknowledgedChange={setPackagingAcknowledged}
      />

      <div className="mt-4 flex items-center gap-2">
        <span className="text-small font-medium text-charcoal">Quantity</span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Decrease quantity"
          disabled={quantity <= minAllowedQuantity}
          onClick={() => setQuantity((current) => Math.max(minAllowedQuantity, current - 1))}
        >
          <Minus />
        </Button>
        <span className="w-6 text-center font-number" aria-live="polite">
          {quantity}
        </span>
        <Button type="button" variant="outline" size="icon-sm" aria-label="Increase quantity" onClick={() => setQuantity((current) => current + 1)}>
          <Plus />
        </Button>
        {minAllowedQuantity > 1 && <span className="text-caption text-charcoal/60">(minimum {minAllowedQuantity} for this packaging)</span>}
      </div>

      <div className="mt-6">
        <ProductActions
          productId={productId}
          inStock={displayInStock}
          variantId={selectedVariantId}
          quantity={quantity}
          variantRequired={variants.length > 0 && !selectedVariantId}
          packaging={packagingSelection?.optionId ? { packagingOptionId: packagingSelection.optionId, declaredAvailability: packagingSelection.declaredAvailability } : null}
          packagingBlocked={packagingRequiresAcknowledgement}
        />
      </div>
    </div>
  );
}
