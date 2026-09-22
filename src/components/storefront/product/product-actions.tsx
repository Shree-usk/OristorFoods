"use client";

import { Heart, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CompareToggle } from "@/components/storefront/product/compare-toggle";
import { useAddToCart } from "@/hooks/use-add-to-cart";
import { useWishlist } from "@/hooks/use-wishlist";

interface ProductActionsProps {
  productId: string;
  inStock: boolean;
}

export function ProductActions({ productId, inStock }: ProductActionsProps) {
  const cart = useAddToCart(productId);
  const wishlist = useWishlist(productId);

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        size="lg"
        disabled={!inStock || !cart.isAvailable}
        onClick={() => cart.addToCart()}
      >
        <ShoppingCart /> {inStock ? "Add to Cart" : "Out of Stock"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        disabled={!wishlist.isAvailable}
        aria-pressed={wishlist.isWishlisted}
        aria-label={wishlist.isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        onClick={wishlist.toggle}
      >
        <Heart className={wishlist.isWishlisted ? "fill-current" : undefined} />
      </Button>
      <CompareToggle productId={productId} className="shrink-0" />
    </div>
  );
}
