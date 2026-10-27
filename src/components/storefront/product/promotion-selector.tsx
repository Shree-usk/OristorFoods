"use client";

import Image from "next/image";
import { useState } from "react";

import { BundleDisplay } from "@/components/storefront/product/bundle-display";
import { ProductPurchasePanel } from "@/components/storefront/product/product-purchase-panel";
import { useVariantSelection } from "@/components/storefront/product/variant-selection-context";
import { cn } from "@/lib/utils";
import type { ProductDetailBundle, ProductDetailBundleItem, ProductDetailPackagingOption, ProductDetailVariant } from "@/services/product.service";

interface PromotionSelectorProps {
  productId: string;
  productName: string;
  productImageSrc: string | null;
  price: number;
  originalPrice: number | null;
  currency: string;
  inStock: boolean;
  rewardPoints: number;
  shortDescription: string | null;
  variants: ProductDetailVariant[];
  packagingOptions: ProductDetailPackagingOption[];
  bundle: ProductDetailBundle | null;
  bundleItems: ProductDetailBundleItem[];
}

type PurchaseOption = "regular" | "bundle";

/**
 * Project Cinnamon — Promotion Selection prototype (Phase 2). Lets a
 * customer choose the regular purchase OR the product's eligible bundle as
 * mutually exclusive options, reusing ProductPurchasePanel and
 * BundleDisplay exactly as they already work (neither is modified — this
 * only decides which one is visible, and shows a compact summary of both
 * above the selected one's full controls). When the product has no
 * eligible bundle, renders ProductPurchasePanel alone — byte-for-byte the
 * same as before this component existed.
 */
export function PromotionSelector({
  productId,
  productName,
  productImageSrc,
  price,
  originalPrice,
  currency,
  inStock,
  rewardPoints,
  shortDescription,
  variants,
  packagingOptions,
  bundle,
  bundleItems,
}: PromotionSelectorProps) {
  const [selected, setSelected] = useState<PurchaseOption>("regular");
  const { selectedVariantId } = useVariantSelection();
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) ?? null;

  const regularPurchasePanel = (
    <ProductPurchasePanel
      productId={productId}
      price={price}
      originalPrice={originalPrice}
      currency={currency}
      inStock={inStock}
      rewardPoints={rewardPoints}
      shortDescription={shortDescription}
      variants={variants}
      packagingOptions={packagingOptions}
    />
  );

  if (!bundle) return regularPurchasePanel;

  // Same variant-aware price ProductPurchasePanel shows at its own top —
  // mirrored here so the "regular" card's price stays correct if the
  // shopper already changed size before looking at this selector.
  const regularDisplayPrice = selectedVariant ? (selectedVariant.promoPrice ?? selectedVariant.price) : price;
  const regularDisplayCurrency = selectedVariant?.currency ?? currency;
  const savings = bundle.standaloneTotal - bundle.discountedTotal;

  return (
    <div>
      <p className="text-small font-medium text-charcoal">How would you like to buy this?</p>
      <div className="mt-2 flex flex-col gap-3">
        <OptionCard
          selected={selected === "regular"}
          onSelect={() => setSelected("regular")}
          imageSrc={productImageSrc}
          title={`${productName} only`}
          priceLabel={`${regularDisplayCurrency} ${regularDisplayPrice.toLocaleString()}`}
        />
        <OptionCard
          selected={selected === "bundle"}
          onSelect={() => setSelected("bundle")}
          disabled={!bundle.inStock}
          imageSrc={bundleItems[0]?.imageSrc || null}
          title={bundle.name}
          priceLabel={`${bundle.currency} ${bundle.discountedTotal.toLocaleString()}`}
          originalPriceLabel={savings > 0 ? `${bundle.currency} ${bundle.standaloneTotal.toLocaleString()}` : null}
          savingsLabel={savings > 0 ? `Save ${bundle.currency} ${savings.toLocaleString()}` : null}
          unavailableLabel={!bundle.inStock ? "Currently unavailable" : null}
        />
      </div>

      <div className="mt-4">{selected === "regular" ? regularPurchasePanel : <BundleDisplay bundle={bundle} items={bundleItems} />}</div>
    </div>
  );
}

interface OptionCardProps {
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  imageSrc: string | null;
  title: string;
  priceLabel: string;
  originalPriceLabel?: string | null;
  savingsLabel?: string | null;
  unavailableLabel?: string | null;
}

/**
 * Same selected-state treatment (chilli border + tint) VariantSelector
 * already uses for its own size chips, scaled up into a full-width row —
 * image is decorative (alt=""), same convention VariantSelector's own
 * chip images use, since the title text right next to it already names
 * the option.
 */
function OptionCard({ selected, onSelect, disabled, imageSrc, title, priceLabel, originalPriceLabel, savingsLabel, unavailableLabel }: OptionCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
        selected ? "border-chilli bg-chilli/5" : "border-input hover:border-charcoal/40",
        disabled && "cursor-not-allowed opacity-60 hover:border-input",
      )}
    >
      {imageSrc ? (
        <Image src={imageSrc} alt="" width={56} height={56} className="size-14 shrink-0 rounded-md bg-cream object-contain" />
      ) : (
        <span className="flex size-14 shrink-0 items-center justify-center rounded-md bg-beige text-caption text-charcoal/40" aria-hidden="true">
          —
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-small font-medium text-charcoal">{title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <span className="font-number text-small text-charcoal">{priceLabel}</span>
          {originalPriceLabel && <span className="font-number text-caption text-charcoal/50 line-through">{originalPriceLabel}</span>}
          {savingsLabel && <span className="rounded-full bg-chilli px-2 py-0.5 text-caption font-medium text-cream">{savingsLabel}</span>}
        </div>
        {unavailableLabel && <p className="mt-0.5 text-caption text-destructive">{unavailableLabel}</p>}
      </div>
      <span
        aria-hidden="true"
        className={cn("size-4 shrink-0 rounded-full border-2", selected ? "border-chilli bg-chilli" : "border-charcoal/30")}
      />
    </button>
  );
}
