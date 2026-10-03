"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchFreeShippingThreshold, fetchLowStockThreshold, updateFreeShippingThreshold, updateLowStockThreshold } from "@/lib/api/admin-system-settings-client";

/**
 * STORY-054. The single global free-shipping threshold only — zone-
 * specific rates are STORY-055's own console (linked out to below).
 * Low Stock threshold replaces admin-dashboard.service.ts's previously
 * hardcoded constant (docs/blueprint.md's own "pending STORY-054" note).
 */
export function ShippingInventorySettingsPanel() {
  const queryClient = useQueryClient();
  const [freeShipping, setFreeShipping] = useState("0");
  const [lowStock, setLowStock] = useState("10");
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: freeShippingData } = useQuery({ queryKey: ["admin-settings-shipping"], queryFn: fetchFreeShippingThreshold });
  const { data: lowStockData } = useQuery({ queryKey: ["admin-settings-inventory"], queryFn: fetchLowStockThreshold });

  if ((freeShippingData !== undefined || lowStockData !== undefined) && !seeded) {
    setSeeded(true);
    if (freeShippingData != null) setFreeShipping(String(freeShippingData));
    if (lowStockData !== undefined) setLowStock(String(lowStockData));
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    try {
      await Promise.all([updateFreeShippingThreshold(Number(freeShipping)), updateLowStockThreshold(Number(lowStock))]);
      queryClient.invalidateQueries({ queryKey: ["admin-settings-shipping"] });
      queryClient.invalidateQueries({ queryKey: ["admin-settings-inventory"] });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save shipping/inventory settings.");
    }
  }

  return (
    <div className="grid max-w-md gap-4">
      {error && <p className="text-small text-destructive">{error}</p>}
      {saved && <p className="text-small text-charcoal/70">Saved.</p>}

      <div>
        <Label htmlFor="free-shipping-threshold">Free shipping threshold (LKR)</Label>
        <Input id="free-shipping-threshold" type="number" min={0} step="0.01" value={freeShipping} onChange={(event) => setFreeShipping(event.target.value)} />
        <p className="mt-1 text-caption text-muted-foreground">
          Global, not per zone. Zone-specific rates live in{" "}
          <Link href="/admin/delivery-zones" className="underline">
            Delivery Zone Management
          </Link>
          .
        </p>
      </div>

      <div>
        <Label htmlFor="low-stock-threshold">Low stock threshold</Label>
        <Input id="low-stock-threshold" type="number" min={0} step="1" value={lowStock} onChange={(event) => setLowStock(event.target.value)} />
        <p className="mt-1 text-caption text-muted-foreground">Products at or below this quantity show as low stock on the dashboard and admin product list.</p>
      </div>

      <Button type="button" className="w-fit" onClick={handleSave}>
        Save
      </Button>
    </div>
  );
}
