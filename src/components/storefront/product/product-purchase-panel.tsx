"use client";

import { useState } from "react";

import { ProductActions } from "@/components/storefront/product/product-actions";
import { VariantSelector } from "@/components/storefront/product/variant-selector";
import type { ProductDetailVariant } from "@/services/product.service";

interface ProductPurchasePanelProps {
  productId: string;
  price: number;
  originalPrice: number | null;
  currency: string;
  inStock: boolean;
  rewardPoints: number;
  variants: ProductDetailVariant[];
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
export function ProductPurchasePanel({ productId, price, originalPrice, currency, inStock, rewardPoints, variants }: ProductPurchasePanelProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(() => defaultVariantId(variants));
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) ?? null;

  const displayPrice = selectedVariant ? (selectedVariant.promoPrice ?? selectedVariant.price) : price;
  const displayOriginalPrice = selectedVariant?.promoPrice ? selectedVariant.price : originalPrice;
  const displayCurrency = selectedVariant?.currency ?? currency;
  const displayInStock = selectedVariant ? selectedVariant.inStock && selectedVariant.stockQuantity > 0 : inStock;

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

      <VariantSelector variants={variants} selectedVariantId={selectedVariantId} onSelect={setSelectedVariantId} />

      <div className="mt-6">
        <ProductActions productId={productId} inStock={displayInStock} variantId={selectedVariantId} variantRequired={variants.length > 0 && !selectedVariantId} />
      </div>
    </div>
  );
}
