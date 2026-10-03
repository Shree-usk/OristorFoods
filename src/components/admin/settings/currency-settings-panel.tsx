"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchCurrencySetting, updateCurrencySetting } from "@/lib/api/admin-system-settings-client";

/**
 * STORY-054. Multi-currency launch scope is still open
 * (docs/blueprint.md Section 10) — this is a settings shell, not a
 * specific exchange-rate integration: a base currency, a supported-
 * currency list, and an optional manual rate override per currency.
 */
export function CurrencySettingsPanel() {
  const queryClient = useQueryClient();
  const [baseCurrency, setBaseCurrency] = useState("LKR");
  const [supportedCurrencies, setSupportedCurrencies] = useState("LKR");
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data } = useQuery({ queryKey: ["admin-settings-currencies"], queryFn: fetchCurrencySetting });

  if (data && !seeded) {
    setSeeded(true);
    setBaseCurrency(data.baseCurrency);
    setSupportedCurrencies(data.supportedCurrencies.join(", "));
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    try {
      await updateCurrencySetting({
        baseCurrency: baseCurrency.trim().toUpperCase(),
        supportedCurrencies: supportedCurrencies.split(",").map((code) => code.trim().toUpperCase()).filter(Boolean),
      });
      queryClient.invalidateQueries({ queryKey: ["admin-settings-currencies"] });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save currency settings.");
    }
  }

  return (
    <div className="grid max-w-md gap-4">
      {error && <p className="text-small text-destructive">{error}</p>}
      {saved && <p className="text-small text-charcoal/70">Saved.</p>}

      <div>
        <Label htmlFor="currency-base">Base currency</Label>
        <Input id="currency-base" value={baseCurrency} onChange={(event) => setBaseCurrency(event.target.value)} maxLength={3} />
      </div>
      <div>
        <Label htmlFor="currency-supported">Supported currencies (comma-separated)</Label>
        <Input id="currency-supported" value={supportedCurrencies} onChange={(event) => setSupportedCurrencies(event.target.value)} placeholder="LKR, USD" />
      </div>

      <Button type="button" className="w-fit" onClick={handleSave}>
        Save
      </Button>
    </div>
  );
}
