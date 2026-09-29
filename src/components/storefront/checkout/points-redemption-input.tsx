"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import type { CartSummary } from "@/types/cart";

/**
 * Reward-points redemption (STORY-030), checkout Review step only — the
 * amount worth redeeming depends on the final payable total, which isn't
 * settled until delivery is resolved, so unlike CouponInput this has no
 * cart-page/drawer counterpart. Authenticated only: a guest has no ledger,
 * so this renders nothing until the session resolves as authenticated.
 */
export function PointsRedemptionInput({ cart }: { cart: CartSummary }) {
  const { status } = useSession();
  const { applyPoints, removePoints, isApplyingPoints, isRemovingPoints } = useCart();
  const [points, setPoints] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (status !== "authenticated" || cart.pointsBalance <= 0) return null;

  async function handleApply(event: React.FormEvent) {
    event.preventDefault();
    const parsed = Number(points);
    if (!Number.isInteger(parsed) || parsed <= 0) return;
    setError(null);
    try {
      await applyPoints(parsed);
      setPoints("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "These points couldn't be applied.");
    }
  }

  async function handleRemove() {
    setError(null);
    try {
      await removePoints();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove points.");
    }
  }

  if (cart.pointsRedemption) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-input p-3">
        <div>
          <p className="text-small font-semibold text-charcoal">{cart.pointsRedemption.points} reward points applied</p>
          <p className="mt-0.5 text-small text-charcoal/70">
            −{cart.currency} {cart.pointsRedemption.value.toFixed(2)}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={handleRemove} disabled={isRemovingPoints}>
          Remove
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleApply} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <label htmlFor="reward-points" className="sr-only">
          Reward points to redeem
        </label>
        <input
          id="reward-points"
          type="number"
          min={1}
          step={1}
          value={points}
          onChange={(event) => setPoints(event.target.value)}
          placeholder={`Redeem points (${cart.pointsBalance} available)`}
          className="flex-1 rounded-lg border border-input px-3 py-2 text-body text-charcoal focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        />
        <Button type="submit" variant="outline" disabled={isApplyingPoints || !points.trim()}>
          {isApplyingPoints ? "Applying…" : "Apply"}
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
