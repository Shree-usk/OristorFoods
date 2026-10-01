"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchReferralSetting, updateReferralSettingAdmin } from "@/lib/api/rewards-referrals-admin-client";

interface ReferralRuleFormValues {
  referrerBonusPoints: string;
  minQualifyingOrderValue: string;
  attributionWindowDays: string;
  referredWelcomeBonusPoints: string;
  maxReferralsPerPeriod: string;
  referralPeriodDays: string;
}

const EMPTY_VALUES: ReferralRuleFormValues = {
  referrerBonusPoints: "",
  minQualifyingOrderValue: "",
  attributionWindowDays: "",
  referredWelcomeBonusPoints: "",
  maxReferralsPerPeriod: "",
  referralPeriodDays: "",
};

function toInputValue(value: string | number | null): string {
  return value === null ? "" : String(value);
}

function toNullableNumber(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

export function AdminReferralRulesPanel() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data } = useQuery({ queryKey: ["admin-referral-setting"], queryFn: fetchReferralSetting });
  const { register, handleSubmit, reset } = useForm<ReferralRuleFormValues>({ defaultValues: EMPTY_VALUES });

  const seeded = useRef(false);
  useEffect(() => {
    if (!data || seeded.current) return;
    seeded.current = true;
    reset({
      referrerBonusPoints: toInputValue(data.referrerBonusPoints),
      minQualifyingOrderValue: toInputValue(data.minQualifyingOrderValue),
      attributionWindowDays: toInputValue(data.attributionWindowDays),
      referredWelcomeBonusPoints: toInputValue(data.referredWelcomeBonusPoints),
      maxReferralsPerPeriod: toInputValue(data.maxReferralsPerPeriod),
      referralPeriodDays: toInputValue(data.referralPeriodDays),
    });
  }, [data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setActionError(null);
    setSaved(false);
    try {
      await updateReferralSettingAdmin({
        referrerBonusPoints: toNullableNumber(values.referrerBonusPoints),
        minQualifyingOrderValue: toNullableNumber(values.minQualifyingOrderValue),
        attributionWindowDays: toNullableNumber(values.attributionWindowDays),
        referredWelcomeBonusPoints: toNullableNumber(values.referredWelcomeBonusPoints),
        maxReferralsPerPeriod: toNullableNumber(values.maxReferralsPerPeriod),
        referralPeriodDays: toNullableNumber(values.referralPeriodDays),
      });
      queryClient.invalidateQueries({ queryKey: ["admin-referral-setting"] });
      setSaved(true);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to save referral rule settings.");
    }
  });

  return (
    <form onSubmit={onSubmit} className="mt-4 max-w-md">
      <p className="text-small text-charcoal/70">Rules the storefront Referral Programme runs on. Every field is optional.</p>

      <Label htmlFor="referrer-bonus" className="mt-4 block">
        Referrer bonus (points)
      </Label>
      <Input id="referrer-bonus" type="number" min={0} {...register("referrerBonusPoints")} />

      <Label htmlFor="min-qualifying-value" className="mt-4 block">
        Minimum qualifying order value
      </Label>
      <Input id="min-qualifying-value" type="number" min={0} placeholder="Any confirmed order qualifies" {...register("minQualifyingOrderValue")} />

      <Label htmlFor="attribution-window" className="mt-4 block">
        Attribution window (days)
      </Label>
      <Input id="attribution-window" type="number" min={1} placeholder="30-day default" {...register("attributionWindowDays")} />

      <Label htmlFor="welcome-bonus" className="mt-4 block">
        Referred customer&apos;s welcome bonus (points)
      </Label>
      <Input id="welcome-bonus" type="number" min={0} placeholder="No welcome bonus" {...register("referredWelcomeBonusPoints")} />

      <h3 className="mt-6 text-h4 font-heading text-charcoal">Fraud threshold</h3>
      <Label htmlFor="max-referrals" className="mt-3 block">
        Max referrals per period
      </Label>
      <Input id="max-referrals" type="number" min={1} placeholder="No cap" {...register("maxReferralsPerPeriod")} />
      <Label htmlFor="referral-period" className="mt-3 block">
        Period (days)
      </Label>
      <Input id="referral-period" type="number" min={1} placeholder="No cap" {...register("referralPeriodDays")} />
      <p className="mt-1 text-small text-charcoal/60">A referrer exceeding this is flagged for review, never auto-blocked.</p>

      {actionError && <p className="mt-3 text-small text-destructive">{actionError}</p>}
      {saved && <p className="mt-3 text-small text-charcoal/70">Saved.</p>}

      <Button type="submit" className="mt-4">
        Save
      </Button>
    </form>
  );
}
