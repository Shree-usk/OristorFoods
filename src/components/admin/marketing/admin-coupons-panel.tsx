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
  createCouponAdmin,
  fetchCoupons,
  updateCouponAdmin,
  type CouponAdmin,
  type CouponDiscountTypeValue,
  type CouponFormInput,
  type CouponScopeValue,
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

function emptyForm(): CouponFormInput {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    code: "",
    discountType: "PercentageOff",
    percentOff: 10,
    amountOff: null,
    startDate: now.toISOString().slice(0, 10),
    endDate: in30Days.toISOString().slice(0, 10),
    minOrderValue: null,
    usageLimitGlobal: null,
    usageLimitPerCustomer: null,
    scope: "AllProducts",
    stackable: false,
    scopeProductIds: [],
    scopeCategoryIds: [],
  };
}

function toFormInput(coupon: CouponAdmin): CouponFormInput {
  return {
    code: coupon.code,
    discountType: coupon.discountType,
    percentOff: coupon.percentOff !== null ? Number(coupon.percentOff) : null,
    amountOff: coupon.amountOff !== null ? Number(coupon.amountOff) : null,
    startDate: toDateInputValue(coupon.startDate),
    endDate: toDateInputValue(coupon.endDate),
    minOrderValue: coupon.minOrderValue !== null ? Number(coupon.minOrderValue) : null,
    usageLimitGlobal: coupon.usageLimitGlobal,
    usageLimitPerCustomer: coupon.usageLimitPerCustomer,
    scope: coupon.scope,
    stackable: coupon.stackable,
    scopeProductIds: coupon.scopeProducts.map((row) => row.productId),
    scopeCategoryIds: coupon.scopeCategories.map((row) => row.categoryId),
  };
}

export function AdminCouponsPanel() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponFormInput>(emptyForm());

  const { data } = useQuery({ queryKey: ["admin-coupons"], queryFn: fetchCoupons });
  const { data: referenceData } = useQuery({ queryKey: ["admin-product-reference-data"], queryFn: fetchProductFormReferenceData });
  const coupons = data?.coupons ?? [];

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(coupon: CouponAdmin) {
    setEditingId(coupon.id);
    setForm(toFormInput(coupon));
    setDialogOpen(true);
  }

  async function toggleActive(coupon: CouponAdmin) {
    setActionError(null);
    try {
      await updateCouponAdmin(coupon.id, { isActive: !coupon.isActive });
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to update the coupon.");
    }
  }

  async function handleSubmit() {
    setActionError(null);
    try {
      if (editingId) {
        await updateCouponAdmin(editingId, form);
      } else {
        await createCouponAdmin(form);
      }
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to save the coupon.");
    }
  }

  function toggleScopeId(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((existing) => existing !== id) : [...list, id];
  }

  return (
    <div className="mt-4">
      {actionError && <p className="mb-2 text-small text-destructive">{actionError}</p>}

      <div className="flex items-center justify-between">
        <h3 className="text-h4 font-heading text-charcoal">Coupons</h3>
        <Button type="button" size="sm" onClick={openCreate}>
          New coupon
        </Button>
      </div>
      <Table className="mt-2">
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Discount</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>Window</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {coupons.map((coupon) => (
            <TableRow key={coupon.id}>
              <TableCell className="font-medium">{coupon.code}</TableCell>
              <TableCell>
                {coupon.discountType === "PercentageOff" && `${coupon.percentOff}% off`}
                {coupon.discountType === "FixedAmountOff" && `${coupon.currency} ${coupon.amountOff} off`}
                {coupon.discountType === "FreeShipping" && "Free shipping"}
              </TableCell>
              <TableCell>{coupon.scope}</TableCell>
              <TableCell>
                {toDateInputValue(coupon.startDate)} – {toDateInputValue(coupon.endDate)}
              </TableCell>
              <TableCell>
                <UiBadge variant={coupon.isActive ? "default" : "outline"}>{coupon.isActive ? "Active" : "Inactive"}</UiBadge>
              </TableCell>
              <TableCell className="space-x-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(coupon)}>
                  Edit
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => toggleActive(coupon)}>
                  {coupon.isActive ? "Deactivate" : "Activate"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {coupons.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-small text-charcoal/60">
                No coupons yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <h2 className="text-h4 font-heading text-charcoal">{editingId ? "Edit coupon" : "New coupon"}</h2>

          <Label htmlFor="coupon-code" className="mt-3 block">
            Code
          </Label>
          <Input id="coupon-code" value={form.code} disabled={!!editingId} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="SUMMER10" />

          <Label htmlFor="coupon-discount-type" className="mt-3 block">
            Discount type
          </Label>
          <Select value={form.discountType} onValueChange={(value) => setForm({ ...form, discountType: value as CouponDiscountTypeValue })}>
            <SelectTrigger id="coupon-discount-type">
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
              <Label htmlFor="coupon-percent-off" className="mt-3 block">
                Percentage off
              </Label>
              <Input
                id="coupon-percent-off"
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
              <Label htmlFor="coupon-amount-off" className="mt-3 block">
                Amount off (LKR)
              </Label>
              <Input
                id="coupon-amount-off"
                type="number"
                min={0}
                value={form.amountOff ?? ""}
                onChange={(event) => setForm({ ...form, amountOff: event.target.value === "" ? null : Number(event.target.value) })}
              />
            </>
          )}

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="coupon-start-date">Start date</Label>
              <Input id="coupon-start-date" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="coupon-end-date">End date</Label>
              <Input id="coupon-end-date" type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
            </div>
          </div>

          <Label htmlFor="coupon-min-order" className="mt-3 block">
            Minimum order value (optional)
          </Label>
          <Input
            id="coupon-min-order"
            type="number"
            min={0}
            value={form.minOrderValue ?? ""}
            onChange={(event) => setForm({ ...form, minOrderValue: event.target.value === "" ? null : Number(event.target.value) })}
          />

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="coupon-usage-global">Total usage limit (optional)</Label>
              <Input
                id="coupon-usage-global"
                type="number"
                min={1}
                value={form.usageLimitGlobal ?? ""}
                onChange={(event) => setForm({ ...form, usageLimitGlobal: event.target.value === "" ? null : Number(event.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="coupon-usage-per-customer">Per-customer limit (optional)</Label>
              <Input
                id="coupon-usage-per-customer"
                type="number"
                min={1}
                value={form.usageLimitPerCustomer ?? ""}
                onChange={(event) => setForm({ ...form, usageLimitPerCustomer: event.target.value === "" ? null : Number(event.target.value) })}
              />
            </div>
          </div>

          <Label htmlFor="coupon-scope" className="mt-3 block">
            Applies to
          </Label>
          <Select value={form.scope} onValueChange={(value) => setForm({ ...form, scope: value as CouponScopeValue })}>
            <SelectTrigger id="coupon-scope">
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
            <Button type="button" disabled={!form.code.trim()} onClick={handleSubmit}>
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
