"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";
import type { ProductDetailVariant } from "@/services/product.service";

interface VariantSelectorProps {
  variants: ProductDetailVariant[];
  selectedVariantId: string | null;
  onSelect: (variantId: string) => void;
}

/**
 * Selectable size/format chips for a variant-driven product — renders
 * nothing when the product has no variants, so a plain product's PDP is
 * byte-for-byte unchanged. Unavailable sizes stay visible but disabled
 * (not hidden), so the customer understands why a size is missing
 * rather than wondering if it was ever offered.
 */
export function VariantSelector({ variants, selectedVariantId, onSelect }: VariantSelectorProps) {
  if (variants.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="text-small font-medium text-charcoal">Size</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {variants.map((variant) => {
          const unavailable = !variant.inStock || variant.stockQuantity <= 0;
          const selected = variant.id === selectedVariantId;
          const image = variant.images[0];
          return (
            <button
              key={variant.id}
              type="button"
              disabled={unavailable}
              aria-pressed={selected}
              onClick={() => onSelect(variant.id)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-small transition-colors",
                selected ? "border-chilli bg-chilli/10 text-chilli" : "border-input text-charcoal hover:border-charcoal/40",
                unavailable && "cursor-not-allowed border-input bg-muted text-charcoal/40 hover:border-input",
              )}
            >
              {image ? (
                <Image src={image.url} alt="" width={24} height={24} className="size-6 shrink-0 rounded object-contain" />
              ) : (
                <span className="flex size-6 shrink-0 items-center justify-center rounded bg-beige text-[10px] text-charcoal/40" aria-hidden="true">
                  —
                </span>
              )}
              {variant.name}
              {unavailable && <span className="ml-1.5">(unavailable)</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
