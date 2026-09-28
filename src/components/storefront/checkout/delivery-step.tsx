"use client";

import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { resolveDelivery } from "@/lib/api/checkout-client";
import { useCheckoutStore } from "@/lib/stores/checkout-store";
import type { DeliveryResolution } from "@/types/checkout";

function formatCharge(resolution: Extract<DeliveryResolution, { status: "ok" }>): string {
  return resolution.charge === 0 ? "Free" : `LKR ${resolution.charge.toFixed(2)}`;
}

function estimatedWindow(resolution: Extract<DeliveryResolution, { status: "ok" }>): string | null {
  const { estimatedDaysMin: min, estimatedDaysMax: max } = resolution;
  if (min === null && max === null) return null;
  if (min !== null && max !== null) return min === max ? `${min} day${min === 1 ? "" : "s"}` : `${min}–${max} days`;
  const single = min ?? max;
  return `${single} day${single === 1 ? "" : "s"}`;
}

const FAIL_SAFE_MESSAGES: Record<Exclude<DeliveryResolution["status"], "ok">, string> = {
  no_zone: "We don't deliver to this city yet — please contact us for a shipping quote, or try a different delivery address.",
  quote_required: "We couldn't calculate a delivery charge for this order automatically. Please contact us for a shipping quote.",
  config_error: "Delivery pricing is unavailable for this address right now. Please contact support.",
};

/**
 * Step 2: the zone/charge resolution is re-fetched from the server every
 * time this step renders with a city (the cart or address may have
 * changed mid-checkout) — never reused from stale wizard state.
 */
export function DeliveryStep() {
  const { address, delivery, setDelivery, goToStep } = useCheckoutStore();
  const city = address?.city ?? "";

  const resolutionQuery = useQuery({
    queryKey: ["checkout-delivery", city],
    queryFn: async () => {
      const resolution = await resolveDelivery(city);
      setDelivery(resolution);
      return resolution;
    },
    enabled: city.length > 0,
    staleTime: 0,
  });

  const resolution = resolutionQuery.data ?? delivery;

  return (
    <div>
      <h2 className="text-h3 font-heading text-charcoal">Delivery Method</h2>
      <p className="mt-2 text-small text-charcoal/70">
        Delivering to <span className="font-semibold text-charcoal">{city}</span>.
      </p>

      <div aria-live="polite" className="mt-6">
        {resolutionQuery.isPending && <p className="text-body text-charcoal/70">Calculating your delivery charge…</p>}

        {resolutionQuery.isError && (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-small text-destructive">
            {resolutionQuery.error instanceof Error ? resolutionQuery.error.message : "Could not calculate delivery. Please try again."}
          </p>
        )}

        {resolution && resolution.status !== "ok" && (
          <p role="alert" className="rounded-lg border border-gold bg-cream p-4 text-small text-charcoal">
            {FAIL_SAFE_MESSAGES[resolution.status]}
          </p>
        )}

        {resolution?.status === "ok" && (
          <div className="rounded-lg border border-input p-4">
            <div className="flex items-center justify-between text-body text-charcoal">
              <span>
                Standard delivery — <span className="font-semibold">{resolution.zoneName}</span>
              </span>
              <span className="font-number font-semibold">{formatCharge(resolution)}</span>
            </div>
            {estimatedWindow(resolution) && (
              <p className="mt-1 text-small text-charcoal/70">Estimated delivery: {estimatedWindow(resolution)}</p>
            )}
            {resolution.campaignApplied && (
              <p className="mt-1 text-small text-leaf-dark">Campaign applied: {resolution.campaignApplied}</p>
            )}
            {resolution.freeShippingApplied && <p className="mt-1 text-small text-leaf-dark">You qualify for free shipping!</p>}
            {!resolution.freeShippingApplied && resolution.amountToFreeShipping !== null && (
              <p className="mt-1 text-small text-charcoal/70">
                Add <span className="font-number">LKR {resolution.amountToFreeShipping.toFixed(2)}</span> more for free shipping.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={() => goToStep(1)}>
          Back to Address
        </Button>
        <Button type="button" disabled={resolution?.status !== "ok"} onClick={() => goToStep(3)}>
          Continue to Payment
        </Button>
      </div>
    </div>
  );
}
