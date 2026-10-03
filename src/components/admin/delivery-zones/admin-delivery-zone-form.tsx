"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import {
  createZone,
  fetchZone,
  updateZone,
  upsertZoneRate,
  type DeliveryRateTier,
  type DeliveryRateTypeValue,
} from "@/lib/api/admin-delivery-zones-client";
import { DeliveryZoneOverridesPanel } from "./delivery-zone-overrides-panel";

interface AdminDeliveryZoneFormProps {
  zoneId: string | null;
}

/**
 * STORY-055. Mirrors admin-recipe-form.tsx's single-page, multi-
 * section pattern. Zone fields and the rate are saved independently
 * (separate API calls) per the skill's own "zones rarely change,
 * rates change often" reasoning — not one combined nested write.
 */
export function AdminDeliveryZoneForm({ zoneId }: AdminDeliveryZoneFormProps) {
  const router = useRouter();
  const isNew = zoneId === null;

  const [name, setName] = useState("");
  const [citiesText, setCitiesText] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [rateType, setRateType] = useState<DeliveryRateTypeValue>("Flat");
  const [flatAmount, setFlatAmount] = useState("0");
  const [tiers, setTiers] = useState<DeliveryRateTier[]>([{ upTo: 1000, amount: "0.00" }]);
  const [estimatedDaysMin, setEstimatedDaysMin] = useState("");
  const [estimatedDaysMax, setEstimatedDaysMax] = useState("");
  const [seeded, setSeeded] = useState(isNew);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: zone } = useQuery({
    queryKey: ["admin-delivery-zone", zoneId],
    queryFn: () => fetchZone(zoneId as string),
    enabled: !isNew,
  });

  if (zone && !seeded) {
    setSeeded(true);
    setName(zone.name);
    setCitiesText(zone.cities.join(", "));
    setIsActive(zone.isActive);
    if (zone.rate) {
      setRateType(zone.rate.rateType);
      setFlatAmount(zone.rate.flatAmount ?? "0");
      if (zone.rate.tiers && zone.rate.tiers.length > 0) setTiers(zone.rate.tiers);
      setEstimatedDaysMin(zone.rate.estimatedDaysMin?.toString() ?? "");
      setEstimatedDaysMax(zone.rate.estimatedDaysMax?.toString() ?? "");
    }
  }

  async function handleSaveZone() {
    setError(null);
    setSaved(false);
    const cities = citiesText.split(",").map((city) => city.trim()).filter(Boolean);

    try {
      if (isNew) {
        const created = await createZone({ name, cities, isActive });
        router.push(`/admin/delivery-zones/${created.id}`);
        return;
      }
      await updateZone(zoneId, { name, cities, isActive });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the zone.");
    }
  }

  async function handleSaveRate() {
    if (isNew) return;
    setError(null);
    setSaved(false);
    try {
      await upsertZoneRate(zoneId, {
        rateType,
        flatAmount: rateType === "Flat" ? Number(flatAmount) : undefined,
        tiers: rateType !== "Flat" ? tiers : undefined,
        estimatedDaysMin: estimatedDaysMin ? Number(estimatedDaysMin) : null,
        estimatedDaysMax: estimatedDaysMax ? Number(estimatedDaysMax) : null,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the rate.");
    }
  }

  function updateTier(index: number, field: "upTo" | "amount", value: string) {
    setTiers((prev) => prev.map((tier, i) => (i === index ? { ...tier, [field]: field === "upTo" ? Number(value) : value } : tier)));
  }

  return (
    <div className="grid max-w-2xl gap-8">
      <h1 className="text-h2 font-heading text-charcoal">{isNew ? "New Delivery Zone" : name || "Delivery Zone"}</h1>

      {error && <p className="text-small text-destructive">{error}</p>}
      {saved && <p className="text-small text-charcoal/70">Saved.</p>}

      <div className="grid gap-4">
        <div>
          <Label htmlFor="zone-name">Zone name</Label>
          <Input id="zone-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="zone-cities">Cities (comma-separated)</Label>
          <Input id="zone-cities" value={citiesText} onChange={(event) => setCitiesText(event.target.value)} placeholder="Colombo, Dehiwala, Mount Lavinia" />
        </div>
        <CheckboxOption label="Active" checked={isActive} onCheckedChange={setIsActive} />
        <Button type="button" className="w-fit" onClick={handleSaveZone} disabled={!name.trim() || !citiesText.trim()}>
          {isNew ? "Create zone" : "Save zone"}
        </Button>
      </div>

      {!isNew && (
        <div className="grid gap-4 border-t border-border pt-6">
          <p className="text-small font-medium text-charcoal">Rate</p>

          <div>
            <Label>Rate type</Label>
            <Select value={rateType} onValueChange={(value) => setRateType(value as DeliveryRateTypeValue)}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Flat">Flat rate</SelectItem>
                <SelectItem value="WeightBased">Weight-based</SelectItem>
                <SelectItem value="ValueBased">Order-value-based</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {rateType === "Flat" ? (
            <div>
              <Label htmlFor="zone-flat-amount">Flat amount (LKR)</Label>
              <Input id="zone-flat-amount" type="number" min={0} step="0.01" value={flatAmount} onChange={(event) => setFlatAmount(event.target.value)} />
            </div>
          ) : (
            <div>
              <Label>{rateType === "WeightBased" ? "Weight tiers (grams up to → amount)" : "Order value tiers (subtotal up to → amount)"}</Label>
              <div className="mt-1 grid gap-2">
                {tiers.map((tier, index) => (
                  <div key={index} className="flex gap-2">
                    <Input type="number" min={0} value={tier.upTo} onChange={(event) => updateTier(index, "upTo", event.target.value)} />
                    <Input type="number" min={0} step="0.01" value={tier.amount} onChange={(event) => updateTier(index, "amount", event.target.value)} />
                    <Button type="button" variant="outline" size="sm" onClick={() => setTiers((prev) => prev.filter((_, i) => i !== index))}>
                      Remove
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setTiers((prev) => [...prev, { upTo: 0, amount: "0.00" }])}>
                  Add tier
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="zone-days-min">Estimated days (min)</Label>
              <Input id="zone-days-min" type="number" min={1} value={estimatedDaysMin} onChange={(event) => setEstimatedDaysMin(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="zone-days-max">Estimated days (max)</Label>
              <Input id="zone-days-max" type="number" min={1} value={estimatedDaysMax} onChange={(event) => setEstimatedDaysMax(event.target.value)} />
            </div>
          </div>

          <Button type="button" className="w-fit" onClick={handleSaveRate}>
            Save rate
          </Button>
        </div>
      )}

      {!isNew && (
        <div className="border-t border-border pt-6">
          <DeliveryZoneOverridesPanel zoneId={zoneId} />
        </div>
      )}
    </div>
  );
}
