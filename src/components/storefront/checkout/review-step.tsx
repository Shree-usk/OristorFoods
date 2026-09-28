"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/api-error";
import { placeOrder } from "@/lib/api/checkout-client";
import { useCheckoutStore } from "@/lib/stores/checkout-store";
import type { CartSummary } from "@/types/cart";

/**
 * Step 4: the customer's last look before committing. The figures shown
 * here come from the live cart query + the server-resolved delivery
 * charge; place-order re-derives all of them server-side and rejects with
 * totals_changed if anything moved since payment was confirmed.
 */
export function ReviewStep({ cart }: { cart: CartSummary }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { address, guestEmail, saveAddress, delivery, intent, idempotencyKey, resetPaymentAttempt, goToStep, completeOrder } =
    useCheckoutStore();
  const [isPlacing, setIsPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  if (!address || delivery?.status !== "ok" || !intent) return null;

  const grandTotal = Math.round((cart.subtotal + delivery.charge) * 100) / 100;

  async function handlePlaceOrder() {
    if (!address || !intent) return;
    setIsPlacing(true);
    setPlaceError(null);
    try {
      const result = await placeOrder({
        idempotencyKey,
        address,
        guestEmail: guestEmail ?? undefined,
        providerReference: intent.providerReference,
        save: saveAddress || undefined,
      });
      completeOrder(result.orderNumber);
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
      router.push(`/checkout/confirmation/${result.orderNumber}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // totals_changed / stock conflict: the confirmed payment no longer
        // matches. Void the attempt and send the customer back to pay the
        // current total with a fresh idempotency key.
        setPlaceError(`${error.message} Delivery and item prices have been refreshed.`);
        await queryClient.invalidateQueries({ queryKey: ["cart"] });
        resetPaymentAttempt();
        return;
      }
      setPlaceError(error instanceof ApiError ? error.message : "Your order could not be placed. Please try again.");
    } finally {
      setIsPlacing(false);
    }
  }

  return (
    <div>
      <h2 className="text-h3 font-heading text-charcoal">Review &amp; Place Order</h2>

      <div className="mt-6 flex flex-col gap-6">
        <section aria-labelledby="review-items-heading">
          <h3 id="review-items-heading" className="text-h4 font-heading text-charcoal">
            Items
          </h3>
          <ul className="mt-2 divide-y divide-input">
            {cart.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 py-2 text-body text-charcoal">
                <span>
                  {item.productName} <span className="text-charcoal/60">× {item.quantity}</span>
                </span>
                <span className="font-number">
                  {item.currency} {item.lineTotal.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="review-address-heading">
          <h3 id="review-address-heading" className="text-h4 font-heading text-charcoal">
            Delivering to
          </h3>
          <p className="mt-2 text-body text-charcoal">
            {address.recipientName}, {address.line1}
            {address.line2 ? `, ${address.line2}` : ""}, {address.city}
            {address.district ? `, ${address.district}` : ""}
            {address.postalCode ? ` ${address.postalCode}` : ""} · {address.phone}
          </p>
          <p className="mt-1 text-small text-charcoal/70">
            Zone: {delivery.zoneName}
            {delivery.campaignApplied ? ` (${delivery.campaignApplied})` : ""}
          </p>
        </section>

        <section aria-labelledby="review-totals-heading" className="rounded-lg border border-input p-4">
          <h3 id="review-totals-heading" className="text-h4 font-heading text-charcoal">
            Total
          </h3>
          <dl className="mt-2 flex flex-col gap-1 text-body text-charcoal">
            <div className="flex items-center justify-between">
              <dt>Subtotal</dt>
              <dd className="font-number">
                {cart.currency} {cart.subtotal.toFixed(2)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Delivery</dt>
              <dd className="font-number">{delivery.charge === 0 ? "Free" : `${cart.currency} ${delivery.charge.toFixed(2)}`}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-input pt-2 font-semibold">
              <dt>Grand total</dt>
              <dd className="font-number">
                {cart.currency} {grandTotal.toFixed(2)}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-small text-charcoal/70">Prices include applicable taxes.</p>
          <p className="mt-1 text-small text-charcoal/70">
            You&apos;ll earn <span className="font-number">{cart.rewardPointsEarned}</span> reward points with this order.
          </p>
        </section>
      </div>

      <div aria-live="assertive">
        {placeError && (
          <p role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-small text-destructive">
            {placeError}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={() => goToStep(3)} disabled={isPlacing}>
          Back to Payment
        </Button>
        <Button type="button" onClick={handlePlaceOrder} disabled={isPlacing}>
          {isPlacing ? "Placing your order…" : "Place Order"}
        </Button>
      </div>
    </div>
  );
}
