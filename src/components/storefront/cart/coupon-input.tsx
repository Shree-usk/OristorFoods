"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import type { CartSummary } from "@/types/cart";

/**
 * Coupon-code apply/remove (STORY-029), shared by the cart drawer and the
 * checkout Review step — both read the same ["cart"] query, so applying
 * here is reflected everywhere immediately (see use-cart.ts).
 */
export function CouponInput({ cart }: { cart: CartSummary }) {
  const { applyCoupon, removeCoupon, isApplyingCoupon, isRemovingCoupon } = useCart();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleApply(event: React.FormEvent) {
    event.preventDefault();
    if (!code.trim()) return;
    setError(null);
    try {
      await applyCoupon(code);
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "This coupon couldn't be applied.");
    }
  }

  async function handleRemove() {
    setError(null);
    try {
      await removeCoupon();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove coupon.");
    }
  }

  if (cart.couponCode) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-input p-3">
        <div>
          <p className="text-small font-semibold text-charcoal">Coupon {cart.couponCode} applied</p>
          {cart.couponInvalidReason === "min_order_value_not_met" && (
            <p className="mt-0.5 text-small text-charcoal/70">Add more to your cart to unlock this discount.</p>
          )}
          {cart.couponInvalidReason && cart.couponInvalidReason !== "min_order_value_not_met" && (
            <p className="mt-0.5 text-small text-destructive">This coupon no longer applies.</p>
          )}
          {!cart.couponInvalidReason && !cart.discount && (
            <p className="mt-0.5 text-small text-charcoal/70">Savings will show at checkout.</p>
          )}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={handleRemove} disabled={isRemovingCoupon}>
          Remove
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleApply} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <label htmlFor="coupon-code" className="sr-only">
          Coupon code
        </label>
        <input
          id="coupon-code"
          type="text"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Coupon code"
          className="flex-1 rounded-lg border border-input px-3 py-2 text-body text-charcoal focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        />
        <Button type="submit" variant="outline" disabled={isApplyingCoupon || !code.trim()}>
          {isApplyingCoupon ? "Applying…" : "Apply"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-small text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
