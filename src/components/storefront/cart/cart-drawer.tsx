"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { CartLineItemRow } from "@/components/storefront/cart/cart-line-item";
import { EmptyCart } from "@/components/storefront/cart/empty-cart";
import { useCart } from "@/hooks/use-cart";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const { cart, updateQuantity, removeItem, isUpdatingItemId, updateQuantityError, isRemovingItemId, removeItemError } = useCart();
  const [announcement, setAnnouncement] = useState("");

  function handleRemove(itemId: string, productName: string) {
    removeItem(itemId);
    setAnnouncement(`Removed ${productName} from cart.`);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <div className="flex h-full w-full max-w-md flex-col bg-cream p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-h4 font-heading text-charcoal">Your Cart</h2>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close cart" onClick={onClose}>
            ×
          </Button>
        </div>
        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>

        <div className="mt-4 flex-1 overflow-y-auto">
          {!cart || cart.items.length === 0 ? (
            <EmptyCart />
          ) : (
            cart.items.map((item) => (
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
            ))
          )}
        </div>

        {cart && cart.items.length > 0 && (
          <div className="mt-4 border-t border-input pt-4">
            <div className="flex items-center justify-between text-body font-medium text-charcoal">
              <span>Subtotal</span>
              <span>
                {cart.currency} {cart.subtotal.toFixed(2)}
              </span>
            </div>
            <Link href="/cart" className={buttonVariants({ variant: "outline", className: "mt-4 w-full justify-center" })} onClick={onClose}>
              View Cart
            </Link>
            <Link href="/checkout" className={buttonVariants({ variant: "default", className: "mt-2 w-full justify-center" })} onClick={onClose}>
              Proceed to Checkout
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
