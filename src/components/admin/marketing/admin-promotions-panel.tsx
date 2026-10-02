"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge as UiBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CouponScopeProductPicker } from "@/components/admin/marketing/coupon-scope-product-picker";
import { fetchProductFormReferenceData } from "@/lib/api/admin-product-client";
import {
  createPromotionAdmin,
  fetchPromotions,
  updatePromotionAdmin,
  type CouponDiscountTypeValue,
  type CouponScopeValue,
  type PromotionAdmin,
  type PromotionFormInput,
} from "@/lib/api/coupon-admin-client";

const DISCOUNT_TYPES: { value: CouponDiscountTypeValue; label: string }[] = [
  { value: "PercentageOff", label: "Percentage off" },
  { value: "FixedAmountOff", label: "Fixed amount off" },
  { value: "FreeShipping", label: "Free shipping" },
];

const SCOPES: { value: CouponScopeValue; label: string }[] = [
  { value: "AllProducts", label: "All products" },
  { value: "Category", label: "Specific categories" },
  { value: "Product", label: "Specific products" },
];

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

function emptyForm(): PromotionFormInput {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    name: "",
    displayLabel: "",
    discountType: "PercentageOff",
    percentOff: 10,
    amountOff: null,
    startDate: now.toISOString().slice(0, 10),
    endDate: in30Days.toISOString().slice(0, 10),
    minOrderValue: null,
    scope: "AllProducts",
    stackable: false,
    priority: 0,
    scopeProductIds: [],
    scopeCategoryIds: [],
  };
}

function toFormInput(promotion: PromotionAdmin): PromotionFormInput {
  return {
    name: promotion.name,
    displayLabel: promotion.displayLabel,
    discountType: promotion.discountType,
    percentOff: promotion.percentOff !== null ? Number(promotion.percentOff) : null,
    amountOff: promotion.amountOff !== null ? Number(promotion.amountOff) : null,
    startDate: toDateInputValue(promotion.startDate),
    endDate: toDateInputValue(promotion.endDate),
    minOrderValue: promotion.minOrderValue !== null ? Number(promotion.minOrderValue) : null,
    scope: promotion.scope,
    stackable: promotion.stackable,
    priority: promotion.priority,
    scopeProductIds: promotion.scopeProducts.map((row) => row.productId),
    scopeCategoryIds: promotion.scopeCategories.map((row) => row.categoryId),
  };
}

/**
 * Auto-applied discounts — no code to redeem, so no usage-limit fields
 * (unlike Coupons). `priority` is the tie-break documented on the
 * Promotion model itself (lower wins) when more than one promotion is
 * simultaneously eligible.
 */
export function AdminPromotionsPanel() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PromotionFormInput>(emptyForm());

  const { data } = useQuery({ queryKey: ["admin-promotions"], queryFn: fetchPromotions });
  const { data: referenceData } = useQuery({ queryKey: ["admin-product-reference-data"], queryFn: fetchProductFormReferenceData });
  const promotions = data?.promotions ?? [];

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(promotion: PromotionAdmin) {
    setEditingId(promotion.id);
    setForm(toFormInput(promotion));
    setDialogOpen(true);
  }

  async function toggleActive(promotion: PromotionAdmin) {
    setActionError(null);
    try {
      await updatePromotionAdmin(promotion.id, { isActive: !promotion.isActive });
      queryClient.invalidateQueries({ queryKey: ["admin-promotions"] });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to update the promotion.");
    }
  }

  async function handleSubmit() {
    setActionError(null);
    try {
      if (editingId) {
        await updatePromotionAdmin(editingId, form);
      } else {
        await createPromotionAdmin(form);
      }
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-promotions"] });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to save the promotion.");
    }
  }

  function toggleScopeId(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((existing) => existing !== id) : [...list, id];
  }

  return (
    <div className="mt-4">
      {actionError && <p className="mb-2 text-small text-destructive">{actionError}</p>}

      <div className="flex items-center justify-between">
        <h3 className="text-h4 font-heading text-charcoal">Promotions</h3>
        <Button type="button" size="sm" onClick={openCreate}>
          New promotion
        </Button>
      </div>
      <Table className="mt-2">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Discount</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>Window</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {promotions.map((promotion) => (
            <TableRow key={promotion.id}>
              <TableCell className="font-medium">{promotion.name}</TableCell>
              <TableCell>
                {promotion.discountType === "PercentageOff" && `${promotion.percentOff}% off`}
                {promotion.discountType === "FixedAmountOff" && `${promotion.currency} ${promotion.amountOff} off`}
                {promotion.discountType === "FreeShipping" && "Free shipping"}
              </TableCell>
              <TableCell>{promotion.scope}</TableCell>
              <TableCell>
                {toDateInputValue(promotion.startDate)} – {toDateInputValue(promotion.endDate)}
              </TableCell>
              <TableCell>
                <UiBadge variant={promotion.isActive ? "default" : "outline"}>{promotion.isActive ? "Active" : "Inactive"}</UiBadge>
              </TableCell>
              <TableCell className="space-x-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(promotion)}>
                  Edit
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => toggleActive(promotion)}>
                  {promotion.isActive ? "Deactivate" : "Activate"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {promotions.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-small text-charcoal/60">
                No promotions yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <h2 className="text-h4 font-heading text-charcoal">{editingId ? "Edit promotion" : "New promotion"}</h2>

          <Label htmlFor="promotion-name" className="mt-3 block">
            Internal name
          </Label>
          <Input id="promotion-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Weekend Sale" />

          <Label htmlFor="promotion-display-label" className="mt-3 block">
            Customer-facing label
          </Label>
          <Input id="promotion-display-label" value={form.displayLabel} onChange={(event) => setForm({ ...form, displayLabel: event.target.value })} placeholder="Weekend Sale — 10% off" />

          <Label htmlFor="promotion-discount-type" className="mt-3 block">
            Discount type
          </Label>
          <Select value={form.discountType} onValueChange={(value) => setForm({ ...form, discountType: value as CouponDiscountTypeValue })}>
            <SelectTrigger id="promotion-discount-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DISCOUNT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {form.discountType === "PercentageOff" && (
            <>
              <Label htmlFor="promotion-percent-off" className="mt-3 block">
                Percentage off
              </Label>
              <Input
                id="promotion-percent-off"
                type="number"
                min={0}
                max={100}
                value={form.percentOff ?? ""}
                onChange={(event) => setForm({ ...form, percentOff: event.target.value === "" ? null : Number(event.target.value) })}
              />
            </>
          )}

          {form.discountType === "FixedAmountOff" && (
            <>
              <Label htmlFor="promotion-amount-off" className="mt-3 block">
                Amount off (LKR)
              </Label>
              <Input
                id="promotion-amount-off"
                type="number"
                min={0}
                value={form.amountOff ?? ""}
                onChange={(event) => setForm({ ...form, amountOff: event.target.value === "" ? null : Number(event.target.value) })}
              />
            </>
          )}

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="promotion-start-date">Start date</Label>
              <Input id="promotion-start-date" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="promotion-end-date">End date</Label>
              <Input id="promotion-end-date" type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
            </div>
          </div>

          <Label htmlFor="promotion-min-order" className="mt-3 block">
            Minimum order value (optional)
          </Label>
          <Input
            id="promotion-min-order"
            type="number"
            min={0}
            value={form.minOrderValue ?? ""}
            onChange={(event) => setForm({ ...form, minOrderValue: event.target.value === "" ? null : Number(event.target.value) })}
          />

          <Label htmlFor="promotion-priority" className="mt-3 block">
            Priority (lower wins a tie against another simultaneously-eligible promotion)
          </Label>
          <Input id="promotion-priority" type="number" value={form.priority} onChange={(event) => setForm({ ...form, priority: Number(event.target.value) })} />

          <Label htmlFor="promotion-scope" className="mt-3 block">
            Applies to
          </Label>
          <Select value={form.scope} onValueChange={(value) => setForm({ ...form, scope: value as CouponScopeValue })}>
            <SelectTrigger id="promotion-scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCOPES.map((scope) => (
                <SelectItem key={scope.value} value={scope.value}>
                  {scope.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {form.scope === "Category" && (
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-input p-2">
              {(referenceData?.categories ?? []).map((category) => (
                <CheckboxOption
                  key={category.id}
                  label={category.name}
                  checked={form.scopeCategoryIds.includes(category.id)}
                  onCheckedChange={() => setForm({ ...form, scopeCategoryIds: toggleScopeId(form.scopeCategoryIds, category.id) })}
                />
              ))}
            </div>
          )}

          {form.scope === "Product" && (
            <div className="mt-2">
              <CouponScopeProductPicker value={form.scopeProductIds} onChange={(scopeProductIds) => setForm({ ...form, scopeProductIds })} />
            </div>
          )}

          <div className="mt-3">
            <CheckboxOption label="Stackable with other stackable coupons/promotions" checked={form.stackable} onCheckedChange={() => setForm({ ...form, stackable: !form.stackable })} />
          </div>

          <div className="mt-4 flex gap-2">
            <Button type="button" disabled={!form.name.trim() || !form.displayLabel.trim()} onClick={handleSubmit}>
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
