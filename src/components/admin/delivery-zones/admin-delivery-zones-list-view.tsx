"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  activateZone,
  bulkImportDeliveryZonesAdmin,
  deactivateZone,
  fetchCoverageGaps,
  fetchZones,
  type BulkImportResult,
} from "@/lib/api/admin-delivery-zones-client";

// Columns match bulkImportDeliveryZones' CSV parsing (delivery-zone.service.ts):
// cities use ";" not "," (parseSimpleCsv has no quoted-field support), rate
// columns are optional, and tiers are "upTo:amount" pairs joined by ";".
const CSV_TEMPLATE = [
  "name,cities,isActive,rateType,flatAmount,tiers,estimatedDaysMin,estimatedDaysMax",
  "Colombo,Colombo;Dehiwala;Nugegoda,true,Flat,350,,1,2",
  "Kandy,Kandy;Peradeniya,true,WeightBased,,500:300;1000:450;2000:600,2,4",
].join("\n");

function activeOverride(overrides: { startsAt: string; endsAt: string; freeShipping: boolean; overrideAmount: string | null }[]) {
  const now = Date.now();
  return overrides.find((override) => new Date(override.startsAt).getTime() <= now && new Date(override.endsAt).getTime() >= now);
}

/**
 * STORY-055. Mirrors admin-recipe-list-view.tsx's list + "New" button
 * shape — a top-level admin module, not a System Settings tab, per
 * AdminModule.DeliveryZones being its own gate.
 */
export function AdminDeliveryZonesListView() {
  const queryClient = useQueryClient();
  const { data: zones } = useQuery({ queryKey: ["admin-delivery-zones"], queryFn: fetchZones });
  const { data: coverageGaps } = useQuery({ queryKey: ["admin-delivery-zones-coverage-gaps"], queryFn: fetchCoverageGaps });
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-delivery-zones"] });
    queryClient.invalidateQueries({ queryKey: ["admin-delivery-zones-coverage-gaps"] });
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    setError(null);
    try {
      if (isActive) await deactivateZone(id);
      else await activateZone(id);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update the zone's status.");
    }
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImportError(null);
    setImportResult(null);
    try {
      const csv = await file.text();
      const result = await bulkImportDeliveryZonesAdmin(csv);
      setImportResult(result);
      invalidate();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to import the CSV file.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-heading text-charcoal">Delivery Zones</h1>
        <div className="flex items-center gap-2">
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`}
            download="delivery-zones-template.csv"
            className="text-small font-medium text-charcoal/70 underline-offset-2 hover:underline"
          >
            Download CSV template
          </a>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileSelected} />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            Import CSV
          </Button>
          <Button nativeButton={false} render={<Link href="/admin/delivery-zones/new" />}>
            New Zone
          </Button>
        </div>
      </div>

      {error && <p className="mt-4 text-small text-destructive">{error}</p>}

      {importError && <p className="mt-4 text-small text-destructive">{importError}</p>}
      {importResult && (
        <div className="mt-4 rounded border border-input p-3 text-small">
          <p className="font-medium text-charcoal">
            Imported {importResult.succeeded.length} zone{importResult.succeeded.length === 1 ? "" : "s"}
            {importResult.failed.length > 0 ? `, ${importResult.failed.length} failed` : ""}.
          </p>
          {importResult.failed.length > 0 && (
            <ul className="mt-2 space-y-1 text-destructive">
              {importResult.failed.map((row) => (
                <li key={row.line}>
                  Line {row.line} ({row.name || "unnamed"}): {row.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {coverageGaps && coverageGaps.length > 0 && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4">
          <p className="text-small font-medium text-amber-900">Coverage gaps</p>
          <p className="mt-1 text-small text-amber-800">
            Customers have used these cities, but no active zone covers them: {coverageGaps.join(", ")}.
          </p>
        </div>
      )}

      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Cities</TableHead>
            <TableHead>Rate type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(zones ?? []).map((zone) => {
            const override = activeOverride(zone.overrides);
            return (
              <TableRow key={zone.id}>
                <TableCell>
                  <Link href={`/admin/delivery-zones/${zone.id}`} className="font-medium text-charcoal underline-offset-2 hover:underline">
                    {zone.name}
                  </Link>
                </TableCell>
                <TableCell>
                  {zone.cities.length <= 3 ? zone.cities.join(", ") : `${zone.cities.slice(0, 3).join(", ")} +${zone.cities.length - 3} more`}
                </TableCell>
                <TableCell>
                  {zone.rate?.rateType ?? "—"}
                  {override && (
                    <span className="ml-2 text-caption text-amber-700">
                      Override active until {new Date(override.endsAt).toLocaleDateString()}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={zone.isActive ? "default" : "outline"}>{zone.isActive ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => handleToggleActive(zone.id, zone.isActive)}>
                    {zone.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
