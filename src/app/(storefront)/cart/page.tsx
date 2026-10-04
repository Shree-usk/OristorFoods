"use client";

import Link from "next/link";
import { useState } from "react";

import { Section } from "@/components/storefront/layout/section";
import { CartCrossSell } from "@/components/storefront/cart/cart-cross-sell";
import { CartLineItemRow } from "@/components/storefront/cart/cart-line-item";
import { CouponInput } from "@/components/storefront/cart/coupon-input";
import { EmptyCart } from "@/components/storefront/cart/empty-cart";
import { buttonVariants } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";

export default function CartPage() {
  const { cart, isPending, updateQuantity, removeItem, isUpdatingItemId, updateQuantityError, isRemovingItemId, removeItemError } = useCart();
  const [announcement, setAnnouncement] = useState("");

  function handleRemove(itemId: string, productName: string) {
    removeItem(itemId);
    setAnnouncement(`Removed ${productName} from cart.`);
  }

  return (
    <Section>
      <h1 className="text-h1 font-heading text-charcoal">Your Cart</h1>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {isPending ? (
        <p className="mt-8 text-body text-charcoal/70">Loading your cart…</p>
      ) : !cart || cart.items.length === 0 ? (
        <EmptyCart />
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {cart.items.map((item) => (
              <CartLineItemRow
                key={item.id}
                item={item}
                onQuantityChange={(quantity) => updateQuantity(item.id, quantity)}
                onRemove={() => handleRemove(item.id, item.productName)}
                isMutating={isUpdatingItemId === item.id || isRemovingItemId === item.id}
                error={
                  (updateQuantityError?.itemId === item.id && updateQuantityError.message) ||
                  (removeItemError?.itemId === item.id && removeItemError.message) ||
                  null
                }
              />
            ))}
          </div>
          <div className="rounded-lg border border-input p-6">
            <h2 className="text-h4 font-heading text-charcoal">Order Summary</h2>
            <div className="mt-4">
              <CouponInput cart={cart} />
            </div>
            {cart.discount && (
              <div className="mt-3 flex flex-col gap-1 text-small text-leaf-dark">
                {cart.discount.applied.map((entry, index) => (
                  <div key={`${entry.sourceType}-${index}`} className="flex items-center justify-between">
                    <span>{entry.label}</span>
                    <span>{entry.isFreeShipping ? "Free shipping" : `−${cart.currency} ${entry.amount.toFixed(2)}`}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex items-center justify-between text-body text-charcoal">
              <span>Subtotal</span>
              <span className="font-number">
                {cart.currency} {(cart.subtotal - (cart.discount?.amount ?? 0)).toFixed(2)}
              </span>
            </div>
            <p className="mt-2 text-small text-charcoal/70">
              You&apos;ll earn <span className="font-number">{cart.rewardPointsEarned}</span> reward points with this purchase.
            </p>
            <Link href="/checkout" className={buttonVariants({ variant: "default", className: "mt-6 w-full justify-center" })}>
              Proceed to Checkout
            </Link>
          </div>
        </div>
      )}

      {cart && cart.items.length > 0 && (
        <div className="mt-12">
          <CartCrossSell productIds={cart.items.map((item) => item.productId)} />
        </div>
      )}
    </Section>
  );
}
