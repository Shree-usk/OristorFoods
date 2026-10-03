"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createTaxRateRule,
  deleteTaxRateRule,
  fetchTaxSettings,
  updateTaxDisplayMode,
  type TaxPricingDisplayModeValue,
} from "@/lib/api/admin-system-settings-client";

const EMPTY_RULE = { region: "", category: "", ratePercent: "0", isActive: true };

/** Select.Value shows the raw item value unless given a label-mapping render function (Base UI, not shadcn's Radix wrapper). */
const PRICING_DISPLAY_LABELS: Record<TaxPricingDisplayModeValue, string> = {
  Exclusive: "Tax-exclusive (shown separately)",
  Inclusive: "Tax-inclusive (built into the price)",
};

export function TaxSettingsPanel() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [newRule, setNewRule] = useState(EMPTY_RULE);

  const { data } = useQuery({ queryKey: ["admin-settings-taxes"], queryFn: fetchTaxSettings });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-settings-taxes"] });
  }

  async function handleDisplayModeChange(mode: TaxPricingDisplayModeValue) {
    setError(null);
    try {
      await updateTaxDisplayMode(mode);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update the pricing display mode.");
    }
  }

  async function handleAddRule() {
    setError(null);
    try {
      await createTaxRateRule({ region: newRule.region, category: newRule.category || null, ratePercent: Number(newRule.ratePercent), isActive: newRule.isActive });
      setNewRule(EMPTY_RULE);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add the tax rule.");
    }
  }

  async function handleRemoveRule(id: string) {
    setError(null);
    try {
      await deleteTaxRateRule(id);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove the tax rule.");
    }
  }

  return (
    <div className="grid max-w-3xl gap-6">
      {error && <p className="text-small text-destructive">{error}</p>}

      <div>
        <Label>Pricing display</Label>
        <Select value={data?.setting?.pricingDisplayMode ?? "Exclusive"} onValueChange={(value) => handleDisplayModeChange(value as TaxPricingDisplayModeValue)}>
          <SelectTrigger className="w-64">
            <SelectValue>{(selected: TaxPricingDisplayModeValue | null) => PRICING_DISPLAY_LABELS[selected ?? "Exclusive"]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Exclusive">Tax-exclusive (shown separately)</SelectItem>
            <SelectItem value="Inclusive">Tax-inclusive (built into the price)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="text-small font-medium text-charcoal">Tax rate rules</p>
        <Table className="mt-2">
          <TableHeader>
            <TableRow>
              <TableHead>Region</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Rate %</TableHead>
              <TableHead>Active</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.rules ?? []).map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>{rule.region}</TableCell>
                <TableCell>{rule.category ?? "—"}</TableCell>
                <TableCell>{rule.ratePercent}</TableCell>
                <TableCell>{rule.isActive ? "Yes" : "No"}</TableCell>
                <TableCell>
                  <Button size="sm" variant="destructive" onClick={() => handleRemoveRule(rule.id)}>
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell>
                <Input placeholder="Region" value={newRule.region} onChange={(event) => setNewRule((prev) => ({ ...prev, region: event.target.value }))} />
              </TableCell>
              <TableCell>
                <Input placeholder="Category (optional)" value={newRule.category} onChange={(event) => setNewRule((prev) => ({ ...prev, category: event.target.value }))} />
              </TableCell>
              <TableCell>
                <Input type="number" min={0} max={100} step="0.01" value={newRule.ratePercent} onChange={(event) => setNewRule((prev) => ({ ...prev, ratePercent: event.target.value }))} />
              </TableCell>
              <TableCell>
                <CheckboxOption label="Active" checked={newRule.isActive} onCheckedChange={(checked) => setNewRule((prev) => ({ ...prev, isActive: checked }))} />
              </TableCell>
              <TableCell>
                <Button size="sm" onClick={handleAddRule} disabled={!newRule.region.trim()}>
                  Add
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
