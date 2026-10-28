"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge as UiBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BundleComponentPicker } from "@/components/admin/products/bundle-component-picker";
import { GiftQualifyingProductPicker, type PickedProduct } from "@/components/admin/marketing/gift-qualifying-product-picker";
import { fetchAdminProduct } from "@/lib/api/admin-product-client";
import {
  createGiftOfferAdmin,
  fetchGiftOffers,
  updateGiftOfferAdmin,
  type CreateGiftOfferFormInput,
  type GiftOfferAdmin,
} from "@/lib/api/gift-offer-admin-client";

interface GiftOfferFormState extends CreateGiftOfferFormInput {
  productName: string;
  qualifyingVariantName: string | null;
  giftProductName: string;
  giftVariantName: string | null;
}

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

function emptyForm(): GiftOfferFormState {
  return {
    productId: "",
    productName: "",
    qualifyingVariantId: null,
    qualifyingVariantName: null,
    name: "",
    description: null,
    status: "Active",
    startDate: null,
    endDate: null,
    minQuantity: null,
    minSpend: null,
    giftProductId: "",
    giftProductName: "",
    giftVariantId: null,
    giftVariantName: null,
    giftQuantity: 1,
    giftStockLimit: null,
    redemptionLimitGlobal: null,
    redemptionLimitPerCustomer: null,
    stackable: false,
  };
}

function toFormState(offer: GiftOfferAdmin): GiftOfferFormState {
  return {
    productId: offer.productId,
    productName: offer.product.name,
    qualifyingVariantId: offer.qualifyingVariantId,
    qualifyingVariantName: offer.qualifyingVariant?.name ?? null,
    name: offer.name,
    description: offer.description,
    status: offer.status,
    startDate: offer.startDate ? toDateInputValue(offer.startDate) : null,
    endDate: offer.endDate ? toDateInputValue(offer.endDate) : null,
    minQuantity: offer.minQuantity,
    minSpend: offer.minSpend !== null ? Number(offer.minSpend) : null,
    giftProductId: offer.giftProductId,
    giftProductName: offer.giftProduct.name,
    giftVariantId: offer.giftVariantId,
    giftVariantName: offer.giftVariant?.name ?? null,
    giftQuantity: offer.giftQuantity,
    giftStockLimit: offer.giftStockLimit,
    redemptionLimitGlobal: offer.redemptionLimitGlobal,
    redemptionLimitPerCustomer: offer.redemptionLimitPerCustomer,
    stackable: offer.stackable,
  };
}

/**
 * Story 5 (Free Gift). Standalone admin screen for GiftOffer — own list +
 * create/edit dialog, same shape as AdminCouponsPanel (which this mirrors
 * closely), living beside Coupons/Promotions in the Marketing admin
 * section rather than embedded in the product edit page like
 * ProductBundlePanel (a GiftOffer is its own campaign entity, not a
 * per-product catalog attribute — see the approved plan's Section 5).
 */
export function AdminGiftOffersPanel() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<GiftOfferFormState>(emptyForm());

  const { data } = useQuery({ queryKey: ["admin-gift-offers"], queryFn: fetchGiftOffers });
  const giftOffers = data?.giftOffers ?? [];

  const { data: selectedGiftProduct } = useQuery({
    queryKey: ["admin-product", form.giftProductId],
    queryFn: () => fetchAdminProduct(form.giftProductId),
    enabled: dialogOpen && form.giftProductId.length > 0,
  });
  const selectedGiftProductName: string = selectedGiftProduct?.name ?? form.giftProductName;
  const selectedGiftVariantName: string | null =
    form.giftVariantId && selectedGiftProduct
      ? ((selectedGiftProduct.variants ?? []) as { id: string; name: string }[]).find((variant) => variant.id === form.giftVariantId)?.name ?? null
      : form.giftVariantName;

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(offer: GiftOfferAdmin) {
    setEditingId(offer.id);
    setForm(toFormState(offer));
    setDialogOpen(true);
  }

  async function toggleActive(offer: GiftOfferAdmin) {
    setActionError(null);
    try {
      await updateGiftOfferAdmin(offer.id, { status: offer.status === "Active" ? "Inactive" : "Active" });
      queryClient.invalidateQueries({ queryKey: ["admin-gift-offers"] });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to update the gift offer.");
    }
  }

  async function handleSubmit() {
    setActionError(null);
    const { productName: _productName, qualifyingVariantName: _qualifyingVariantName, giftProductName: _giftProductName, giftVariantName: _giftVariantName, ...input } = form;
    try {
      if (editingId) {
        const { productId: _productId, qualifyingVariantId: _qualifyingVariantId, ...updateInput } = input;
        await updateGiftOfferAdmin(editingId, updateInput);
      } else {
        await createGiftOfferAdmin(input);
      }
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-gift-offers"] });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to save the gift offer.");
    }
  }

  const canSubmit = form.name.trim().length > 0 && (editingId ? true : form.productId.length > 0) && form.giftProductId.length > 0;

  return (
    <div className="mt-4">
      {actionError && <p className="mb-2 text-small text-destructive">{actionError}</p>}

      <div className="flex items-center justify-between">
        <h3 className="text-h4 font-heading text-charcoal">Free Gift Offers</h3>
        <Button type="button" size="sm" onClick={openCreate}>
          New gift offer
        </Button>
      </div>
      <Table className="mt-2">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Qualifying product</TableHead>
            <TableHead>Gift</TableHead>
            <TableHead>Window</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {giftOffers.map((offer) => (
            <TableRow key={offer.id}>
              <TableCell className="font-medium">{offer.name}</TableCell>
              <TableCell>
                {offer.product.name}
                {offer.qualifyingVariant ? ` — ${offer.qualifyingVariant.name}` : ""}
              </TableCell>
              <TableCell>
                {offer.giftQuantity} x {offer.giftProduct.name}
                {offer.giftVariant ? ` — ${offer.giftVariant.name}` : ""}
              </TableCell>
              <TableCell>
                {offer.startDate ? toDateInputValue(offer.startDate) : "—"} – {offer.endDate ? toDateInputValue(offer.endDate) : "—"}
              </TableCell>
              <TableCell>
                <UiBadge variant={offer.status === "Active" ? "default" : "outline"}>{offer.status}</UiBadge>
              </TableCell>
              <TableCell className="space-x-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(offer)}>
                  Edit
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => toggleActive(offer)}>
                  {offer.status === "Active" ? "Deactivate" : "Activate"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {giftOffers.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-small text-charcoal/60">
                No gift offers yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <h2 className="text-h4 font-heading text-charcoal">{editingId ? "Edit gift offer" : "New gift offer"}</h2>

          <Label className="mt-3 block">Qualifying product</Label>
          <p className="text-caption text-charcoal/60">The product a customer must buy to unlock this gift. Set once, not editable afterward.</p>
          <div className="mt-1">
            <GiftQualifyingProductPicker
              value={form.productId ? { id: form.productId, name: form.productName, variantId: form.qualifyingVariantId, variantName: form.qualifyingVariantName } : null}
              disabled={!!editingId}
              onChange={(product: PickedProduct) =>
                setForm({ ...form, productId: product.id, productName: product.name, qualifyingVariantId: product.variantId ?? null, qualifyingVariantName: product.variantName ?? null })
              }
            />
          </div>

          <Label htmlFor="gift-offer-name" className="mt-3 block">
            Name
          </Label>
          <Input id="gift-offer-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Free Chili Paste with Curry Powder" />

          <Label htmlFor="gift-offer-description" className="mt-3 block">
            Description (optional)
          </Label>
          <Textarea id="gift-offer-description" value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value || null })} />

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="gift-offer-start-date">Start date (optional)</Label>
              <Input id="gift-offer-start-date" type="date" value={form.startDate ?? ""} onChange={(event) => setForm({ ...form, startDate: event.target.value || null })} />
            </div>
            <div>
              <Label htmlFor="gift-offer-end-date">End date (optional)</Label>
              <Input id="gift-offer-end-date" type="date" value={form.endDate ?? ""} onChange={(event) => setForm({ ...form, endDate: event.target.value || null })} />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="gift-offer-min-quantity">Minimum quantity (optional)</Label>
              <Input
                id="gift-offer-min-quantity"
                type="number"
                min={1}
                value={form.minQuantity ?? ""}
                onChange={(event) => setForm({ ...form, minQuantity: event.target.value === "" ? null : Number(event.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="gift-offer-min-spend">Minimum spend (optional)</Label>
              <Input
                id="gift-offer-min-spend"
                type="number"
                min={0}
                value={form.minSpend ?? ""}
                onChange={(event) => setForm({ ...form, minSpend: event.target.value === "" ? null : Number(event.target.value) })}
              />
            </div>
          </div>

          <Label className="mt-3 block">Gift product</Label>
          <p className="text-caption text-charcoal/60">The product granted for free — pick a specific size, or the whole product.</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-small text-charcoal">
              {form.giftProductId ? `${selectedGiftProductName}${selectedGiftVariantName ? ` — ${selectedGiftVariantName}` : ""}` : "No gift product selected yet."}
            </span>
            {/* BundleComponentPicker's dropdown anchors right-0, extending leftward from the
                trigger — this row must keep the trigger at the row's right edge (via
                justify-between) or the dropdown renders partly outside the Dialog's bounds,
                where Base UI's outside-click detection treats clicks on it as closing the dialog. */}
            <BundleComponentPicker
              onSelect={(giftProductId, giftVariantId) => setForm({ ...form, giftProductId, giftVariantId, giftProductName: "", giftVariantName: null })}
            />
          </div>

          <Label htmlFor="gift-offer-quantity" className="mt-3 block">
            Gift quantity
          </Label>
          <Input
            id="gift-offer-quantity"
            type="number"
            min={1}
            value={form.giftQuantity}
            onChange={(event) => setForm({ ...form, giftQuantity: event.target.value === "" ? 1 : Number(event.target.value) })}
          />

          <div className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="gift-offer-stock-limit">Gift stock limit (optional)</Label>
              <Input
                id="gift-offer-stock-limit"
                type="number"
                min={1}
                value={form.giftStockLimit ?? ""}
                onChange={(event) => setForm({ ...form, giftStockLimit: event.target.value === "" ? null : Number(event.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="gift-offer-redemption-global">Total redemption limit (optional)</Label>
              <Input
                id="gift-offer-redemption-global"
                type="number"
                min={1}
                value={form.redemptionLimitGlobal ?? ""}
                onChange={(event) => setForm({ ...form, redemptionLimitGlobal: event.target.value === "" ? null : Number(event.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="gift-offer-redemption-per-customer">Per-customer limit (optional)</Label>
              <Input
                id="gift-offer-redemption-per-customer"
                type="number"
                min={1}
                value={form.redemptionLimitPerCustomer ?? ""}
                onChange={(event) => setForm({ ...form, redemptionLimitPerCustomer: event.target.value === "" ? null : Number(event.target.value) })}
              />
            </div>
          </div>

          <div className="mt-3">
            <CheckboxOption label="Stackable with other stackable coupons/promotions" checked={form.stackable} onCheckedChange={() => setForm({ ...form, stackable: !form.stackable })} />
          </div>

          <div className="mt-4 flex gap-2">
            <Button type="button" disabled={!canSubmit} onClick={handleSubmit}>
              {editingId ? "Save" : "Create"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
