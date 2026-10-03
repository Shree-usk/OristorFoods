"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CUSTOMER_GROUPS,
  createSegment,
  fetchRewardTiersForSegmentation,
  fetchSegment,
  previewSegmentCriteria,
  updateSegment,
  type CustomerGroupValue,
  type SegmentFilterCriteria,
  type SegmentPreview,
} from "@/lib/api/admin-crm-client";

const EMPTY_CRITERIA: SegmentFilterCriteria = {};

function toNumberOrUndefined(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** STORY-059a. Shared by /admin/crm/new and /admin/crm/[id] — live preview debounces 400ms after any filter change. */
export function AdminSegmentBuilderView({ segmentId }: { segmentId?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [criteria, setCriteria] = useState<SegmentFilterCriteria>(EMPTY_CRITERIA);
  const [preview, setPreview] = useState<SegmentPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: existing } = useQuery({ queryKey: ["admin-crm-segment", segmentId], queryFn: () => fetchSegment(segmentId!), enabled: !!segmentId });
  const { data: rewardTiers } = useQuery({ queryKey: ["admin-crm-reward-tiers"], queryFn: fetchRewardTiersForSegmentation });

  const seeded = useRef(false);
  useEffect(() => {
    if (!existing || seeded.current) return;
    seeded.current = true;
    setName(existing.segment.name);
    setCriteria(existing.segment.filterCriteria);
    setPreview(existing.preview);
  }, [existing]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      previewSegmentCriteria(criteria)
        .then((result) => {
          setPreview(result);
          setPreviewError(null);
        })
        .catch((error) => setPreviewError(error instanceof Error ? error.message : "Failed to preview the segment."));
    }, 400);
    return () => clearTimeout(timeout);
  }, [criteria]);

  function setFilter<K extends keyof SegmentFilterCriteria>(key: K, value: SegmentFilterCriteria[K]) {
    setCriteria((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaveError(null);
    setSaving(true);
    try {
      if (segmentId) {
        await updateSegment(segmentId, name, criteria);
      } else {
        await createSegment(name, criteria);
      }
      router.push("/admin/crm");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save the segment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-heading text-charcoal">{segmentId ? "Edit segment" : "New segment"}</h1>
        <Button type="button" variant="outline" nativeButton={false} render={<Link href="/admin/crm" />}>
          Back to segments
        </Button>
      </div>

      {saveError && <p className="mt-3 text-small text-destructive">{saveError}</p>}

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <Label htmlFor="segment-name">Segment name</Label>
          <Input id="segment-name" value={name} onChange={(event) => setName(event.target.value)} />

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="segment-min-orders">Min orders</Label>
              <Input id="segment-min-orders" type="number" min={0} value={criteria.minOrderCount ?? ""} onChange={(event) => setFilter("minOrderCount", toNumberOrUndefined(event.target.value))} />
            </div>
            <div>
              <Label htmlFor="segment-max-orders">Max orders</Label>
              <Input id="segment-max-orders" type="number" min={0} value={criteria.maxOrderCount ?? ""} onChange={(event) => setFilter("maxOrderCount", toNumberOrUndefined(event.target.value))} />
            </div>
            <div>
              <Label htmlFor="segment-min-clv">Min lifetime value</Label>
              <Input id="segment-min-clv" type="number" min={0} value={criteria.minLifetimeValue ?? ""} onChange={(event) => setFilter("minLifetimeValue", toNumberOrUndefined(event.target.value))} />
            </div>
            <div>
              <Label htmlFor="segment-max-clv">Max lifetime value</Label>
              <Input id="segment-max-clv" type="number" min={0} value={criteria.maxLifetimeValue ?? ""} onChange={(event) => setFilter("maxLifetimeValue", toNumberOrUndefined(event.target.value))} />
            </div>
            <div>
              <Label htmlFor="segment-last-order-after">Last order after</Label>
              <Input id="segment-last-order-after" type="date" value={criteria.lastOrderAfter ?? ""} onChange={(event) => setFilter("lastOrderAfter", event.target.value || undefined)} />
            </div>
            <div>
              <Label htmlFor="segment-last-order-before">Last order before</Label>
              <Input id="segment-last-order-before" type="date" value={criteria.lastOrderBefore ?? ""} onChange={(event) => setFilter("lastOrderBefore", event.target.value || undefined)} />
            </div>
            <div>
              <Label htmlFor="segment-city">City</Label>
              <Input id="segment-city" value={criteria.city ?? ""} onChange={(event) => setFilter("city", event.target.value || undefined)} />
            </div>
            <div>
              <Label htmlFor="segment-customer-group">Customer group</Label>
              <Select value={criteria.customerGroup ?? "any"} onValueChange={(value) => setFilter("customerGroup", value === "any" ? undefined : (value as CustomerGroupValue))}>
                <SelectTrigger id="segment-customer-group">
                  <SelectValue>{(selected: string | null) => (selected && selected !== "any" ? selected : "Any")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  {CUSTOMER_GROUPS.map((group) => (
                    <SelectItem key={group} value={group}>
                      {group}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="segment-reward-tier">Reward tier</Label>
              <Select value={criteria.rewardTierId ?? "any"} onValueChange={(value) => setFilter("rewardTierId", value && value !== "any" ? value : undefined)}>
                <SelectTrigger id="segment-reward-tier">
                  <SelectValue>{(selected: string | null) => (selected && selected !== "any" ? (rewardTiers?.find((t) => t.id === selected)?.name ?? "Any") : "Any")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  {(rewardTiers ?? []).map((tier) => (
                    <SelectItem key={tier.id} value={tier.id}>
                      {tier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="button" className="mt-4" disabled={!name.trim() || saving} onClick={handleSave}>
            {saving ? "Saving…" : "Save segment"}
          </Button>
        </section>

        <section>
          <h2 className="text-h5 font-heading text-charcoal">Live preview</h2>
          {previewError && <p className="mt-2 text-small text-destructive">{previewError}</p>}
          {preview && (
            <div className="mt-2 text-small text-charcoal/80">
              <p className="text-h4 font-heading text-charcoal">{preview.count} customers</p>
              <p>Total lifetime value: {preview.totalClv.toFixed(2)}</p>
              <p>Average lifetime value: {preview.averageClv.toFixed(2)}</p>
              <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto">
                {preview.members.slice(0, 50).map((member) => (
                  <li key={member.id} className="border-b border-border py-1">
                    {member.name ?? member.email} — {member.orderCount} orders, {member.totalSpent.toFixed(2)} spent
                  </li>
                ))}
              </ul>
              {preview.members.length > 50 && <p className="mt-2 text-charcoal/60">…and {preview.members.length - 50} more.</p>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
