"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_LABELS } from "@/components/storefront/orders/order-status-timeline";

// STORY-036. The real OrderStatus enum — see order.schema.ts's own note.
const STATUS_OPTIONS = ["PendingConfirmation", "Confirmed", "Processing", "Dispatched", "Delivered", "Cancelled", "Returned"] as const;

/** STORY-036. Filters the order list via URL search params — the page (Server Component) re-fetches on navigation, same as product-listing's URL-driven filters. */
export function OrderFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") ?? "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") ?? "");

  function apply() {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    router.push(params.size > 0 ? `${pathname}?${params.toString()}` : pathname);
  }

  function clear() {
    setStatus("");
    setDateFrom("");
    setDateTo("");
    router.push(pathname);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="order-status-filter">Status</Label>
        <Select value={status || undefined} onValueChange={(value) => setStatus(value ?? "")}>
          <SelectTrigger id="order-status-filter" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {STATUS_LABELS[option] ?? option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="order-date-from">From</Label>
        <Input id="order-date-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
      </div>
      <div>
        <Label htmlFor="order-date-to">To</Label>
        <Input id="order-date-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
      </div>
      <Button variant="outline" size="sm" onClick={apply}>
        Apply
      </Button>
      <Button variant="ghost" size="sm" onClick={clear}>
        Clear
      </Button>
    </div>
  );
}
