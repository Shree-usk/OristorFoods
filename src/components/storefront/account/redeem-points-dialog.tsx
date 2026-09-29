"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculatePointsRedemption } from "@/services/rewards-calc";

interface RedeemPointsDialogProps {
  spendableBalance: number;
  pointsToCurrencyRate: number | null;
  maxRedeemablePointsPerOrder: number | null;
}

/**
 * STORY-035. Preview only — the rewards engine (STORY-030) only supports
 * redeeming points as a cart discount at checkout; there's no standalone
 * wallet-redemption mechanism (no store credit/vouchers). This dialog
 * shows what N points would be worth using the same pure calculation
 * checkout itself uses (rewards-calc.ts::calculatePointsRedemption, no
 * DB access, safe to run client-side), with `payableBeforePoints` set
 * high enough that it never becomes the binding cap — only the balance
 * and per-order-cap constraints matter for a preview with no real order
 * behind it. Confirmed with the user before building. See
 * docs/architecture-decisions.md.
 */
export function RedeemPointsDialog({ spendableBalance, pointsToCurrencyRate, maxRedeemablePointsPerOrder }: RedeemPointsDialogProps) {
  const [open, setOpen] = useState(false);
  const [pointsInput, setPointsInput] = useState(() => Math.min(spendableBalance, maxRedeemablePointsPerOrder ?? spendableBalance).toString());

  const redemptionUnavailable = pointsToCurrencyRate === null || pointsToCurrencyRate <= 0 || spendableBalance <= 0;
  const pointsRequested = Number.parseInt(pointsInput, 10) || 0;
  const preview = calculatePointsRedemption({
    pointsRequested,
    spendableBalance,
    pointsToCurrencyRate,
    maxRedeemablePointsPerOrder,
    payableBeforePoints: Number.MAX_SAFE_INTEGER,
  });
  const wasCapped = preview.pointsToRedeem > 0 && preview.pointsToRedeem < pointsRequested;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} disabled={redemptionUnavailable}>
        Redeem points
      </Button>
      <DialogContent>
        <h2 className="text-h3 font-heading text-charcoal">Redeem points</h2>

        <div className="mt-4">
          <Label htmlFor="redeem-points-input">Points to redeem</Label>
          <Input
            id="redeem-points-input"
            type="number"
            min={0}
            max={spendableBalance}
            value={pointsInput}
            onChange={(event) => setPointsInput(event.target.value)}
          />
          <p className="mt-1 text-caption text-charcoal/70">You have {spendableBalance.toLocaleString()} points available.</p>
        </div>

        <div className="mt-4 rounded-lg bg-cream p-3">
          <p className="text-body text-charcoal">
            {preview.pointsToRedeem > 0
              ? `${preview.pointsToRedeem.toLocaleString()} points = LKR ${preview.discountValue.toFixed(2)} off`
              : "Enter a point amount to see its value."}
          </p>
          {wasCapped && (
            <p className="mt-1 text-caption text-charcoal/70">
              Capped at {maxRedeemablePointsPerOrder?.toLocaleString()} points per order.
            </p>
          )}
        </div>

        <p className="mt-4 text-small text-charcoal/70">
          Points are redeemed at checkout, not here — add items to your cart, then apply your points on the payment step.
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Got it
          </Button>
          <Button render={<Link href="/products" />}>Go to shop</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
