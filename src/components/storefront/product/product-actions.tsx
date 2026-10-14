"use client";

import { Heart, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CompareToggle } from "@/components/storefront/product/compare-toggle";
import { useAddToCart, type PackagingSelectionArg } from "@/hooks/use-add-to-cart";
import { useWishlist } from "@/hooks/use-wishlist";

interface ProductActionsProps {
  productId: string;
  inStock: boolean;
  variantId?: string | null;
  /** Export fulfilment flow. Defaults to 1 — auto-bumped by product-purchase-panel.tsx when a minimum-quantity packaging option is selected. */
  quantity?: number;
  /** True when the product has variants but none is currently selected — blocks an ambiguous add. */
  variantRequired?: boolean;
  /** Story 3 (Custom Packaging). Null = default packaging (no surcharge). */
  packaging?: PackagingSelectionArg | null;
  /** True when a packaging option is selected but its required acknowledgement checkbox isn't checked yet — blocks an uninformed add, mirroring variantRequired. */
  packagingBlocked?: boolean;
}

export function ProductActions({
  productId,
  inStock,
  variantId = null,
  quantity = 1,
  variantRequired = false,
  packaging = null,
  packagingBlocked = false,
}: ProductActionsProps) {
  const cart = useAddToCart(productId, variantId, packaging);
  const wishlist = useWishlist(productId);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="lg"
          className="flex-1 sm:flex-none"
          disabled={!inStock || !cart.isAvailable || cart.isAdding || variantRequired || packagingBlocked}
          onClick={() => cart.addToCart(quantity)}
        >
          <ShoppingCart /> {inStock ? "Add to Cart" : "Out of Stock"}
        </Button>
        <div className="flex items-center gap-1 rounded-full border border-input p-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!wishlist.isAvailable}
            aria-pressed={wishlist.isWishlisted}
            aria-label={wishlist.isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            onClick={wishlist.toggle}
          >
            <Heart className={wishlist.isWishlisted ? "fill-current" : undefined} />
          </Button>
          <CompareToggle productId={productId} className="shrink-0" />
        </div>
      </div>
      {cart.error && (
        <p role="alert" className="mt-2 text-small text-destructive">
          {cart.error}
        </p>
      )}
    </div>
  );
}
