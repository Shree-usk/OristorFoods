"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AssetPickerDialog } from "@/components/admin/media/asset-picker-dialog";
import { Button } from "@/components/ui/button";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createVariant,
  deleteVariant,
  fetchAdminProduct,
  setVariantImages,
  updateVariant,
  type VariantFormInput,
} from "@/lib/api/admin-product-client";
import { toastManager } from "@/lib/toast";

const FULFILMENT_RESTRICTIONS = ["None", "LocalOnly", "ExportOnly", "ManualApprovalRequired"] as const;
const FULFILMENT_RESTRICTION_LABELS: Record<(typeof FULFILMENT_RESTRICTIONS)[number], string> = {
  None: "None",
  LocalOnly: "Local orders only",
  ExportOnly: "Export orders only",
  ManualApprovalRequired: "Requires manual approval",
};

const EMPTY_FORM: VariantFormInput = {
  sku: "",
  barcode: "",
  name: "",
  netWeightGrams: 0,
  price: 0,
  promoPrice: null,
  currency: "LKR",
  inStock: true,
  stockQuantity: 0,
  isActive: true,
  shippingWeightGrams: null,
  lengthMm: null,
  widthMm: null,
  heightMm: null,
  fulfilmentRestriction: "None",
};

interface AdminVariant extends VariantFormInput {
  id: string;
  images: { id: string; url: string; altText: string | null; isPrimary: boolean }[];
}

/**
 * Fetches its own product detail (not the parent form's copy), same
 * reasoning as ProductPricingPanel — variants are their own entities
 * with their own add/edit/remove mutations, not part of the tabbed
 * form's single submit. "Save the product first" guard matches the
 * pricing/SEO tabs exactly.
 */
export function ProductVariantsPanel({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  const { data: product, isLoading } = useQuery({ queryKey: ["admin-product", productId], queryFn: () => fetchAdminProduct(productId) });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VariantFormInput>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerTarget, setPickerTarget] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-product", productId] });
  }

  function openEdit(variant: AdminVariant) {
    setEditingId(variant.id);
    setAdding(false);
    setForm({
      sku: variant.sku,
      barcode: variant.barcode ?? "",
      name: variant.name,
      netWeightGrams: variant.netWeightGrams,
      // Prisma Decimal fields serialize to JSON as strings (not numbers) —
      // NextResponse.json() calls Decimal's own toJSON(). Without this
      // conversion, saving a variant without ever touching the Price input
      // sends that string straight through and the server's z.number()
      // check rejects it with a 400 ("Failed to save variant") — a real
      // bug reproduced live against staging data.
      price: Number(variant.price),
      promoPrice: variant.promoPrice !== null && variant.promoPrice !== undefined ? Number(variant.promoPrice) : null,
      currency: variant.currency,
      inStock: variant.inStock,
      stockQuantity: variant.stockQuantity,
      isActive: variant.isActive,
      shippingWeightGrams: variant.shippingWeightGrams ?? null,
      lengthMm: variant.lengthMm ?? null,
      widthMm: variant.widthMm ?? null,
      heightMm: variant.heightMm ?? null,
      fulfilmentRestriction: variant.fulfilmentRestriction ?? "None",
    });
  }

  function openAdd() {
    setAdding(true);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function closeForm() {
    setAdding(false);
    setEditingId(null);
  }

  async function handleSave() {
    setError(null);
    try {
      if (editingId) {
        await updateVariant(productId, editingId, form);
        toastManager.add({ title: "Variant saved" });
      } else {
        await createVariant(productId, form);
        toastManager.add({ title: "Variant added" });
      }
      invalidate();
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save variant.");
    }
  }

  async function handleDelete(variantId: string) {
    setError(null);
    try {
      await deleteVariant(productId, variantId);
      toastManager.add({ title: "Variant deleted" });
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete variant.");
    }
  }

  if (isLoading || !product) return <p className="text-body text-charcoal/70">Loading variants…</p>;

  const variants: AdminVariant[] = product.variants ?? [];
  const dialogOpen = adding || editingId !== null;

  return (
    <div className="space-y-6">
      <p className="text-small text-charcoal/70">
        Sizes/formats of this product — e.g. 100g, 200g, 350g. Each gets its own SKU, price, and stock. Leave empty if this product is sold as a single SKU.
      </p>

      {error && <p className="text-small text-destructive">{error}</p>}

      <div className="flex flex-col gap-3">
        {variants.length === 0 ? (
          <p className="text-small text-charcoal/70">No variants yet.</p>
        ) : (
          variants.map((variant) => (
            <div key={variant.id} className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-small font-medium text-charcoal">
                  {variant.name} — {variant.currency} {variant.promoPrice ?? variant.price}
                  {variant.promoPrice ? <span className="ml-1 text-charcoal/50 line-through">{variant.price}</span> : null}
                </p>
                <p className="text-caption text-charcoal/60">
                  SKU {variant.sku} · {variant.netWeightGrams}g · {variant.stockQuantity} in stock
                  {!variant.isActive ? " · Inactive" : ""}
                  {!variant.inStock ? " · Out of stock" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => openEdit(variant)}>
                  Edit
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => handleDelete(variant.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Button type="button" variant="outline" onClick={openAdd}>
        Add variant
      </Button>

      {dialogOpen && (
        <div className="space-y-3 rounded-md border border-border p-4">
          <h3 className="text-small font-medium text-charcoal">{editingId ? "Edit variant" : "New variant"}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="variant-sku">SKU</Label>
              <Input id="variant-sku" value={form.sku} onChange={(event) => setForm((prev) => ({ ...prev, sku: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="variant-barcode">Barcode (optional)</Label>
              <Input id="variant-barcode" value={form.barcode ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, barcode: event.target.value }))} />
            </div>
          </div>
          <div>
            <Label htmlFor="variant-name">Name</Label>
            <Input id="variant-name" placeholder="e.g. 350g" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="variant-weight">Net weight (grams)</Label>
              <Input id="variant-weight" type="number" value={form.netWeightGrams} onChange={(event) => setForm((prev) => ({ ...prev, netWeightGrams: Number(event.target.value) }))} />
            </div>
            <div>
              <Label htmlFor="variant-stock">Stock quantity</Label>
              <Input id="variant-stock" type="number" value={form.stockQuantity ?? 0} onChange={(event) => setForm((prev) => ({ ...prev, stockQuantity: Number(event.target.value) }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="variant-price">Price</Label>
              <Input id="variant-price" type="number" step="0.01" value={form.price} onChange={(event) => setForm((prev) => ({ ...prev, price: Number(event.target.value) }))} />
            </div>
            <div>
              <Label htmlFor="variant-promo-price">Promo price (optional)</Label>
              <Input
                id="variant-promo-price"
                type="number"
                step="0.01"
                value={form.promoPrice ?? ""}
                onChange={(event) => setForm((prev) => ({ ...prev, promoPrice: event.target.value ? Number(event.target.value) : null }))}
              />
            </div>
            <div>
              <Label htmlFor="variant-currency">Currency</Label>
              <Input id="variant-currency" value={form.currency} onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))} />
            </div>
          </div>

          <div className="flex items-center gap-6 pt-1">
            <CheckboxOption label="Active" checked={form.isActive ?? true} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))} />
            <CheckboxOption label="In stock" checked={form.inStock ?? true} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, inStock: checked }))} />
          </div>

          <div>
            <Label htmlFor="variant-fulfilment">Fulfilment restriction</Label>
            <Select value={form.fulfilmentRestriction ?? "None"} onValueChange={(value) => setForm((prev) => ({ ...prev, fulfilmentRestriction: value as VariantFormInput["fulfilmentRestriction"] }))}>
              <SelectTrigger id="variant-fulfilment">
                <SelectValue>{(selected: string | null) => FULFILMENT_RESTRICTION_LABELS[(selected ?? "None") as (typeof FULFILMENT_RESTRICTIONS)[number]]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FULFILMENT_RESTRICTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {FULFILMENT_RESTRICTION_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <details className="text-small text-charcoal/70">
            <summary className="cursor-pointer">Dimensions &amp; shipping weight (optional)</summary>
            <div className="mt-2 grid grid-cols-4 gap-3">
              <div>
                <Label htmlFor="variant-shipping-weight">Shipping weight (g)</Label>
                <Input
                  id="variant-shipping-weight"
                  type="number"
                  value={form.shippingWeightGrams ?? ""}
                  onChange={(event) => setForm((prev) => ({ ...prev, shippingWeightGrams: event.target.value ? Number(event.target.value) : null }))}
                />
              </div>
              <div>
                <Label htmlFor="variant-length">Length (mm)</Label>
                <Input id="variant-length" type="number" value={form.lengthMm ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, lengthMm: event.target.value ? Number(event.target.value) : null }))} />
              </div>
              <div>
                <Label htmlFor="variant-width">Width (mm)</Label>
                <Input id="variant-width" type="number" value={form.widthMm ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, widthMm: event.target.value ? Number(event.target.value) : null }))} />
              </div>
              <div>
                <Label htmlFor="variant-height">Height (mm)</Label>
                <Input id="variant-height" type="number" value={form.heightMm ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, heightMm: event.target.value ? Number(event.target.value) : null }))} />
              </div>
            </div>
          </details>

          {editingId && (
            <div>
              <Label>Image</Label>
              <div className="mt-1 flex items-center gap-2">
                {variants.find((v) => v.id === editingId)?.images[0] && (
                  // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail only, not a storefront image
                  <img src={variants.find((v) => v.id === editingId)!.images[0].url} alt="" className="h-12 w-12 rounded object-cover" />
                )}
                <Button type="button" size="sm" variant="outline" onClick={() => setPickerTarget(editingId)}>
                  Browse Library
                </Button>
              </div>
              <p className="mt-1 text-caption text-charcoal/60">Optional — falls back to the product&apos;s own images when not set.</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" onClick={handleSave} disabled={!form.sku.trim() || !form.name.trim() || !form.netWeightGrams}>
              {editingId ? "Save variant" : "Add variant"}
            </Button>
            <Button type="button" variant="outline" onClick={closeForm}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <AssetPickerDialog
        open={pickerTarget !== null}
        onOpenChange={(open) => !open && setPickerTarget(null)}
        onSelect={async (asset) => {
          if (!pickerTarget) return;
          try {
            await setVariantImages(productId, pickerTarget, [{ url: asset.url, altText: asset.altText, isPrimary: true }]);
            invalidate();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save the variant image.");
          }
          setPickerTarget(null);
        }}
      />
    </div>
  );
}
