"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createOverride,
  deleteOverride,
  fetchCampaignOptions,
  fetchOverrides,
} from "@/lib/api/admin-delivery-zones-client";

const EMPTY_FORM = {
  campaignOption: "",
  customCampaignName: "",
  startsAt: "",
  endsAt: "",
  overrideKind: "freeShipping" as "freeShipping" | "overrideAmount",
  overrideAmount: "0",
};

/**
 * STORY-055. Scoped to one zone, rendered only on an existing zone's
 * detail page. Campaign field is a picker over live SeasonalCampaign
 * rows plus a free-text fallback — writes into the existing
 * DeliveryRateOverride.campaignName string column (no new FK; see the
 * story's own scope note).
 */
export function DeliveryZoneOverridesPanel({ zoneId }: { zoneId: string }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const { data: overrides } = useQuery({ queryKey: ["admin-delivery-zone-overrides", zoneId], queryFn: () => fetchOverrides(zoneId) });
  const { data: campaigns } = useQuery({ queryKey: ["admin-delivery-zone-campaigns"], queryFn: fetchCampaignOptions });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-delivery-zone-overrides", zoneId] });
  }

  async function handleAdd() {
    setError(null);
    const campaignName = form.campaignOption === "__other__" ? form.customCampaignName.trim() : form.campaignOption;
    if (!campaignName) {
      setError("Choose a campaign or type one.");
      return;
    }

    try {
      await createOverride(zoneId, {
        campaignName,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
        freeShipping: form.overrideKind === "freeShipping",
        overrideAmount: form.overrideKind === "overrideAmount" ? Number(form.overrideAmount) : undefined,
      });
      setForm(EMPTY_FORM);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create the override.");
    }
  }

  async function handleRemove(overrideId: string) {
    setError(null);
    try {
      await deleteOverride(zoneId, overrideId);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove the override.");
    }
  }

  return (
    <div>
      <p className="text-small font-medium text-charcoal">Rate overrides</p>
      {error && <p className="mt-1 text-small text-destructive">{error}</p>}

      <Table className="mt-2">
        <TableHeader>
          <TableRow>
            <TableHead>Campaign</TableHead>
            <TableHead>Starts</TableHead>
            <TableHead>Ends</TableHead>
            <TableHead>Effect</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(overrides ?? []).map((override) => (
            <TableRow key={override.id}>
              <TableCell>{override.campaignName}</TableCell>
              <TableCell>{new Date(override.startsAt).toLocaleDateString()}</TableCell>
              <TableCell>{new Date(override.endsAt).toLocaleDateString()}</TableCell>
              <TableCell>{override.freeShipping ? "Free shipping" : `Rs. ${override.overrideAmount}`}</TableCell>
              <TableCell>
                <Button size="sm" variant="destructive" onClick={() => handleRemove(override.id)}>
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="mt-4 grid gap-3 rounded-md border border-dashed border-border p-4 sm:grid-cols-2">
        <div>
          <Label>Campaign</Label>
          <Select value={form.campaignOption} onValueChange={(value) => setForm((prev) => ({ ...prev, campaignOption: value ?? "" }))}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a campaign" />
            </SelectTrigger>
            <SelectContent>
              {(campaigns ?? []).map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.name}>
                  {campaign.name}
                </SelectItem>
              ))}
              <SelectItem value="__other__">Other (type manually)</SelectItem>
            </SelectContent>
          </Select>
          {form.campaignOption === "__other__" && (
            <Input
              className="mt-2"
              placeholder="Campaign name"
              value={form.customCampaignName}
              onChange={(event) => setForm((prev) => ({ ...prev, customCampaignName: event.target.value }))}
            />
          )}
        </div>

        <div>
          <Label>Effect</Label>
          <Select value={form.overrideKind} onValueChange={(value) => setForm((prev) => ({ ...prev, overrideKind: value as typeof prev.overrideKind }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="freeShipping">Free shipping</SelectItem>
              <SelectItem value="overrideAmount">Fixed override amount</SelectItem>
            </SelectContent>
          </Select>
          {form.overrideKind === "overrideAmount" && (
            <Input
              className="mt-2"
              type="number"
              min={0}
              step="0.01"
              value={form.overrideAmount}
              onChange={(event) => setForm((prev) => ({ ...prev, overrideAmount: event.target.value }))}
            />
          )}
        </div>

        <div>
          <Label htmlFor="override-starts-at">Starts</Label>
          <Input id="override-starts-at" type="date" value={form.startsAt} onChange={(event) => setForm((prev) => ({ ...prev, startsAt: event.target.value }))} />
        </div>
        <div>
          <Label htmlFor="override-ends-at">Ends</Label>
          <Input id="override-ends-at" type="date" value={form.endsAt} onChange={(event) => setForm((prev) => ({ ...prev, endsAt: event.target.value }))} />
        </div>

        <Button type="button" className="w-fit sm:col-span-2" onClick={handleAdd} disabled={!form.startsAt || !form.endsAt}>
          Add override
        </Button>
      </div>
    </div>
  );
}
