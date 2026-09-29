"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";

export interface ReturnableLine {
  orderItemId: string;
  productName: string;
  quantity: number;
}

const TEXTAREA_CLASSNAME =
  "min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

/** STORY-036. Only rendered when the order's status is Delivered (the page decides that, not this component). */
export function ReturnRequestDialog({ orderNumber, items }: { orderNumber: string; items: ReturnableLine[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "error" | "done">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function toggleItem(orderItemId: string, checked: boolean, maxQuantity: number) {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) next[orderItemId] = maxQuantity;
      else delete next[orderItemId];
      return next;
    });
  }

  function setQuantity(orderItemId: string, quantity: number) {
    setSelected((prev) => ({ ...prev, [orderItemId]: quantity }));
  }

  async function handleSubmit() {
    setState("submitting");
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/orders/${orderNumber}/return-request`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason,
          items: Object.entries(selected).map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Something went wrong. Please try again.");
      }
      setState("done");
      router.refresh();
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  }

  const hasSelection = Object.keys(selected).length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSelected({});
          setReason("");
          setState("idle");
        }
      }}
    >
      <Button variant="outline" onClick={() => setOpen(true)}>
        Request a return
      </Button>
      <DialogContent>
        {state === "done" ? (
          <div>
            <h2 className="text-h3 font-heading text-charcoal">Return requested</h2>
            <p className="mt-2 text-body text-charcoal/70">
              We&apos;ve received your return request and will be in touch about next steps.
            </p>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => setOpen(false)}>Close</Button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-h3 font-heading text-charcoal">Request a return</h2>

            <fieldset className="mt-4 flex flex-col gap-3">
              <legend className="text-small font-medium text-charcoal">Items to return</legend>
              {items.map((item) => (
                <div key={item.orderItemId} className="flex items-center gap-3">
                  <CheckboxOption
                    label={item.productName}
                    checked={item.orderItemId in selected}
                    onCheckedChange={(checked) => toggleItem(item.orderItemId, checked, item.quantity)}
                  />
                  {item.orderItemId in selected && (
                    <Input
                      type="number"
                      min={1}
                      max={item.quantity}
                      value={selected[item.orderItemId]}
                      onChange={(event) => setQuantity(item.orderItemId, Number.parseInt(event.target.value, 10) || 1)}
                      className="w-20"
                      aria-label={`Quantity to return for ${item.productName}`}
                    />
                  )}
                </div>
              ))}
            </fieldset>

            <div className="mt-4">
              <Label htmlFor="return-reason">Reason</Label>
              <textarea id="return-reason" className={TEXTAREA_CLASSNAME} value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>

            {state === "error" && errorMessage && <p className="mt-2 text-small text-destructive">{errorMessage}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!hasSelection || !reason.trim() || state === "submitting"}>
                {state === "submitting" ? "Submitting…" : "Submit request"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
