"use client";

import Image from "next/image";

import { Button } from "@/components/ui/button";
import { useAddGiftToCart } from "@/hooks/use-add-gift-to-cart";
import type { ProductDetailGiftOffer } from "@/services/product.service";

interface GiftOfferDisplayProps {
  giftOffer: ProductDetailGiftOffer;
}

/**
 * The expanded "gift" option in PromotionSelector — mirrors BundleDisplay's
 * Fixed-bundle shape (one locked gift, one Add to Cart button, no customer
 * choice) since a GiftOffer always grants exactly one product/variant.
 * Unlike a bundle's price, the gift's own value is never charged — shown
 * only as "worth LKR X" context for the FREE label above.
 */
export function GiftOfferDisplay({ giftOffer }: GiftOfferDisplayProps) {
  const { addGiftToCart, isAdding, error } = useAddGiftToCart(giftOffer.id);

  return (
    <div className="rounded-lg border border-input p-4">
      <h2 className="text-h4 font-heading text-charcoal">{giftOffer.name}</h2>
      {giftOffer.description && <p className="mt-1 text-small text-charcoal/70">{giftOffer.description}</p>}

      <div className="mt-3 flex items-center gap-3 rounded-md border border-input px-3 py-2">
        {giftOffer.giftProductImageSrc ? (
          <Image src={giftOffer.giftProductImageSrc} alt="" width={40} height={40} className="size-10 shrink-0 rounded bg-cream object-contain" />
        ) : (
          <span className="size-10 shrink-0 rounded bg-beige" aria-hidden="true" />
        )}
        <div>
          <p className="text-small font-medium text-charcoal">
            {giftOffer.giftQuantity} x {giftOffer.giftProductName}
          </p>
          <p className="text-caption text-charcoal/60">
            Worth {giftOffer.currency} {giftOffer.standaloneValue.toLocaleString()}
            {!giftOffer.inStock && " · out of stock"}
          </p>
        </div>
      </div>

      <p className="mt-3 text-h4 font-number text-chilli">FREE</p>

      {error && <p className="mt-2 text-small text-destructive">{error}</p>}
      <Button type="button" className="mt-3" disabled={isAdding || !giftOffer.inStock} onClick={() => addGiftToCart()}>
        {giftOffer.inStock ? "Add free gift to cart" : "Currently unavailable"}
      </Button>
    </div>
  );
}
