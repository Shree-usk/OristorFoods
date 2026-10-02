"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchRewardSetting, updateRewardSettingAdmin } from "@/lib/api/rewards-referrals-admin-client";

interface PointRuleFormValues {
  pointsToCurrencyRate: string;
  maxRedeemablePointsPerOrder: string;
  pointsExpiryDays: string;
  orderValuePointsRate: string;
}

const EMPTY_VALUES: PointRuleFormValues = { pointsToCurrencyRate: "", maxRedeemablePointsPerOrder: "", pointsExpiryDays: "", orderValuePointsRate: "" };

function toInputValue(value: string | number | null): string {
  return value === null ? "" : String(value);
}

function toNullableNumber(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

export function AdminPointRulesPanel() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data } = useQuery({ queryKey: ["admin-reward-setting"], queryFn: fetchRewardSetting });
  const { register, handleSubmit, reset } = useForm<PointRuleFormValues>({ defaultValues: EMPTY_VALUES });

  const seeded = useRef(false);
  useEffect(() => {
    if (!data || seeded.current) return;
    seeded.current = true;
    reset({
      pointsToCurrencyRate: toInputValue(data.pointsToCurrencyRate),
      maxRedeemablePointsPerOrder: toInputValue(data.maxRedeemablePointsPerOrder),
      pointsExpiryDays: toInputValue(data.pointsExpiryDays),
      orderValuePointsRate: toInputValue(data.orderValuePointsRate),
    });
  }, [data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setActionError(null);
    setSaved(false);
    try {
      await updateRewardSettingAdmin({
        pointsToCurrencyRate: toNullableNumber(values.pointsToCurrencyRate),
        maxRedeemablePointsPerOrder: toNullableNumber(values.maxRedeemablePointsPerOrder),
        pointsExpiryDays: toNullableNumber(values.pointsExpiryDays),
        orderValuePointsRate: toNullableNumber(values.orderValuePointsRate),
      });
      queryClient.invalidateQueries({ queryKey: ["admin-reward-setting"] });
      setSaved(true);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to save point rule settings.");
    }
  });

  return (
    <form onSubmit={onSubmit} className="mt-4 max-w-md">
      <p className="text-small text-charcoal/70">How points are earned and redeemed storefront-wide. Every field is optional — leave blank to turn that behavior off.</p>

      <Label htmlFor="points-to-currency-rate" className="mt-4 block">
        Points → currency rate (LKR per point redeemed)
      </Label>
      <Input id="points-to-currency-rate" type="number" min={0} step={0.0001} placeholder="Redemption disabled" {...register("pointsToCurrencyRate")} />

      <Label htmlFor="max-redeemable" className="mt-4 block">
        Max redeemable points per order
      </Label>
      <Input id="max-redeemable" type="number" min={1} placeholder="No separate cap" {...register("maxRedeemablePointsPerOrder")} />

      <Label htmlFor="points-expiry-days" className="mt-4 block">
        Points expiry (days)
      </Label>
      <Input id="points-expiry-days" type="number" min={1} placeholder="Points never expire" {...register("pointsExpiryDays")} />

      <Label htmlFor="order-value-rate" className="mt-4 block">
        Order-value bonus (points per LKR of subtotal)
      </Label>
      <Input id="order-value-rate" type="number" min={0} step={0.0001} placeholder="No bonus" {...register("orderValuePointsRate")} />
      <p className="mt-1 text-small text-charcoal/60">Additive on top of the per-product earning — not a replacement.</p>

      {actionError && <p className="mt-3 text-small text-destructive">{actionError}</p>}
      {saved && <p className="mt-3 text-small text-charcoal/70">Saved.</p>}

      <Button type="submit" className="mt-4">
        Save
      </Button>
    </form>
  );
}
