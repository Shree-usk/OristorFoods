"use client";

import { useState } from "react";

import { Section } from "@/components/storefront/layout/section";
import { CartLineItemRow } from "@/components/storefront/cart/cart-line-item";
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
            <div className="mt-4 flex items-center justify-between text-body text-charcoal">
              <span>Subtotal</span>
              <span className="font-number">
                {cart.currency} {cart.subtotal.toFixed(2)}
              </span>
            </div>
            <p className="mt-2 text-small text-charcoal/70">
              You&apos;ll earn <span className="font-number">{cart.rewardPointsEarned}</span> reward points with this purchase.
            </p>
            <button
              type="button"
              disabled
              aria-disabled="true"
              title="Checkout isn't available yet"
              className={buttonVariants({ variant: "default", className: "mt-6 w-full justify-center opacity-50" })}
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}
