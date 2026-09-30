"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { duplicateAdminProduct } from "@/lib/api/admin-product-client";

/** AC: duplicate forces a new, caller-chosen slug/SKU — never auto-generated. */
export function DuplicateProductDialog({ productId, open, onOpenChange }: { productId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [newSlug, setNewSlug] = useState("");
  const [newSku, setNewSku] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      const duplicate = await duplicateAdminProduct(productId, newSlug, newSku);
      onOpenChange(false);
      router.push(`/admin/products/${duplicate.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to duplicate product.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <h2 className="text-h3 font-heading text-charcoal">Duplicate product</h2>
        <p className="mt-1 text-small text-charcoal/70">Choose a new slug and SKU for the copy. Pricing is never copied.</p>
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <Label htmlFor="duplicate-slug">New slug</Label>
            <Input id="duplicate-slug" value={newSlug} onChange={(event) => setNewSlug(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="duplicate-sku">New SKU</Label>
            <Input id="duplicate-sku" value={newSku} onChange={(event) => setNewSku(event.target.value)} />
          </div>
          {error && <p className="text-small text-destructive">{error}</p>}
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting || !newSlug || !newSku}>
            {isSubmitting ? "Duplicating…" : "Duplicate"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
