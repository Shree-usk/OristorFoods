"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toastManager } from "@/lib/toast";

/**
 * STORY-034. Submits a deactivation REQUEST only (User.status ->
 * DeactivationRequested, a soft flag) — it does not sign the customer
 * out or delete anything itself. See /api/account/deactivate's doc
 * comment. Signs out afterward purely as a UX nicety, not a security
 * measure (the account is still fully active until staff act on the
 * request).
 */
export function DeactivateAccountDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setIsSubmitting(true);
    setError(null);
    const response = await fetch("/api/account/deactivate", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason || undefined }),
    });
    setIsSubmitting(false);

    if (!response.ok) {
      setError("Something went wrong. Please try again.");
      return;
    }

    setOpen(false);
    toastManager.add({ title: "Deactivation requested", description: "Our team will follow up before your account is deactivated." });
    await signOut({ redirect: false });
    router.push("/");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Deactivate my account
      </Button>
      <DialogContent>
        <h2 className="text-h3 font-heading text-charcoal">Deactivate your account?</h2>
        <p className="mt-2 text-small text-charcoal/70">
          This submits a deactivation request — our team reviews it before your account is deactivated. It doesn&apos;t delete your data
          immediately.
        </p>

        <div className="mt-4">
          <Label htmlFor="deactivate-reason">Reason (optional)</Label>
          <textarea
            id="deactivate-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={3}
            className="mt-1 w-full rounded-lg border border-input bg-transparent p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        {error && (
          <p role="alert" className="mt-2 text-small text-destructive">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Confirm deactivation"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
