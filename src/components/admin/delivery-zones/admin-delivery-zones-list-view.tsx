"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  activateZone,
  deactivateZone,
  fetchCoverageGaps,
  fetchZones,
} from "@/lib/api/admin-delivery-zones-client";

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

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-heading text-charcoal">Delivery Zones</h1>
        <Button nativeButton={false} render={<Link href="/admin/delivery-zones/new" />}>
          New Zone
        </Button>
      </div>

      {error && <p className="mt-4 text-small text-destructive">{error}</p>}

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
