"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ReorderResult } from "@/services/customer-order-history.service";

/**
 * STORY-036. Posts to /api/orders/[orderNumber]/reorder, which adds every
 * still-in-stock item to the cart in one call; out-of-stock/no-longer-
 * available items come back in `skipped` rather than being silently
 * dropped, per the AC. Shared by the order list card and the order-detail
 * page.
 */
export function ReorderButton({ orderNumber }: { orderNumber: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<ReorderResult | null>(null);

  async function handleReorder() {
    setState("loading");
    try {
      const response = await fetch(`/api/orders/${orderNumber}/reorder`, { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error("Reorder failed");
      const data = (await response.json()) as ReorderResult;
      setResult(data);
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done" && result) {
    return (
      <div role="status" className="text-small text-charcoal">
        {result.addedCount > 0 ? (
          <p>
            Added {result.addedCount} item{result.addedCount === 1 ? "" : "s"} to your{" "}
            <Link href="/cart" className="font-medium text-chilli underline-offset-2 hover:underline">
              cart
            </Link>
            .
          </p>
        ) : (
          <p>None of this order&apos;s items are available to reorder right now.</p>
        )}
        {result.skipped.length > 0 && (
          <ul className="mt-1 text-caption text-charcoal/70">
            {result.skipped.map((skip, index) => (
              <li key={`${skip.productName}-${index}`}>
                {skip.productName}: {skip.reason}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="outline" size="sm" onClick={handleReorder} disabled={state === "loading"}>
        {state === "loading" ? "Reordering…" : "Reorder"}
      </Button>
      {state === "error" && <p className="text-caption text-destructive">Something went wrong. Please try again.</p>}
    </div>
  );
}
