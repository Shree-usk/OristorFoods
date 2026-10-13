"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createPackagingOption,
  deletePackagingOption,
  fetchAdminProduct,
  fetchPackagingOptionsForProduct,
  updatePackagingOption,
  type AdminPackagingOption,
  type PackagingOptionFormInput,
} from "@/lib/api/admin-product-client";
import { fetchAdminPackagingMethods } from "@/lib/api/admin-packaging-method-client";
import { toastManager } from "@/lib/toast";

const AVAILABILITY_OPTIONS = ["Both", "Local", "Export"] as const;
const AVAILABILITY_LABELS: Record<(typeof AVAILABILITY_OPTIONS)[number], string> = {
  Both: "Local & export",
  Local: "Local only",
  Export: "Export only",
};

const STATUS_OPTIONS = ["Active", "TemporarilyUnavailable", "Discontinued"] as const;
const STATUS_LABELS: Record<(typeof STATUS_OPTIONS)[number], string> = {
  Active: "Active",
  TemporarilyUnavailable: "Temporarily unavailable",
  Discontinued: "Discontinued",
};

const EMPTY_ITEM_FORM: PackagingOptionFormInput = {
  packagingMethodId: "",
  variantId: null,
  charge: 0,
  minQuantity: null,
  availability: "Both",
  requiresManualReview: false,
  leadTimeDays: null,
  shelfLifeDays: null,
  shelfLifeText: "",
  customerInstructions: "",
  acknowledgementText: "",
  availabilityStartDate: "",
  availabilityEndDate: "",
  orderCutoffDate: "",
  status: "Active",
  sortOrder: 0,
};

function toDateInputValue(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

function toItemForm(option: AdminPackagingOption): PackagingOptionFormInput {
  return {
    packagingMethodId: option.packagingMethod.id,
    variantId: option.variant?.id ?? null,
    charge: option.charge !== undefined && option.charge !== null ? Number(option.charge) : 0,
    minQuantity: option.minQuantity ?? null,
    availability: option.availability ?? "Both",
    requiresManualReview: option.requiresManualReview ?? false,
    leadTimeDays: option.leadTimeDays ?? null,
    shelfLifeDays: option.shelfLifeDays ?? null,
    shelfLifeText: option.shelfLifeText ?? "",
    customerInstructions: option.customerInstructions ?? "",
    acknowledgementText: option.acknowledgementText ?? "",
    availabilityStartDate: toDateInputValue(option.availabilityStartDate),
    availabilityEndDate: toDateInputValue(option.availabilityEndDate),
    orderCutoffDate: toDateInputValue(option.orderCutoffDate),
    status: option.status ?? "Active",
    sortOrder: option.sortOrder ?? 0,
  };
}

/**
 * Self-contained Packaging tab panel (Story 3), mirroring ProductBundlePanel's
 * own shape: own useQuery for its options, own invalidateQueries, plain
 * async handlers with local error state. No searchable component picker —
 * a packaging option's optional variant pin is always one of THIS same
 * product's own variants, already fetched via the shared
 * ["admin-product", productId] query ProductVariantsPanel also uses.
 */
export function ProductPackagingPanel({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  const { data: options, isLoading } = useQuery({ queryKey: ["admin-packaging-options", productId], queryFn: () => fetchPackagingOptionsForProduct(productId) });
  const { data: methods } = useQuery({ queryKey: ["admin-packaging-methods"], queryFn: fetchAdminPackagingMethods });
  const { data: product } = useQuery({ queryKey: ["admin-product", productId], queryFn: () => fetchAdminProduct(productId) });

  const [itemForm, setItemForm] = useState<PackagingOptionFormInput | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-packaging-options", productId] });
  }

  const activeMethods = (methods ?? []).filter((method) => method.status === "Active");
  const variants: { id: string; name: string }[] = product?.variants ?? [];

  function openAdd() {
    setEditingId(null);
    setError(null);
    setItemForm({ ...EMPTY_ITEM_FORM, packagingMethodId: activeMethods[0]?.id ?? "" });
  }

  function openEdit(option: AdminPackagingOption) {
    setEditingId(option.id);
    setError(null);
    setItemForm(toItemForm(option));
  }

  function closeForm() {
    setItemForm(null);
    setEditingId(null);
  }

  async function handleSave() {
    if (!itemForm) return;
    setError(null);
    try {
      if (editingId) {
        await updatePackagingOption(productId, editingId, itemForm);
        toastManager.add({ title: "Packaging option saved" });
      } else {
        await createPackagingOption(productId, itemForm);
        toastManager.add({ title: "Packaging option added" });
      }
      closeForm();
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save packaging option.");
    }
  }

  async function handleDelete(optionId: string) {
    setError(null);
    try {
      await deletePackagingOption(productId, optionId);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove packaging option.");
    }
  }

  if (isLoading) return <p className="text-body text-charcoal/70">Loading packaging options…</p>;

  const rows = options ?? [];

  return (
    <div className="space-y-6">
      {error && <p className="text-small text-destructive">{error}</p>}

      <div className="flex items-center justify-between">
        <h3 className="text-small font-medium text-charcoal">Packaging options</h3>
        <Button type="button" size="sm" onClick={openAdd} disabled={activeMethods.length === 0}>
          Add packaging option
        </Button>
      </div>
      {activeMethods.length === 0 && (
        <p className="text-small text-charcoal/70">
          No active packaging methods yet — add one in Admin &gt; Packaging methods first.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-small text-charcoal/70">This product has no packaging options configured yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((option) => (
            <div key={option.id} className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-small font-medium text-charcoal">
                  {option.packagingMethod.name}
                  {option.variant && <span className="text-charcoal/70"> — {option.variant.name}</span>}
                  {option.status !== "Active" && <span className="ml-2 text-caption text-destructive">({STATUS_LABELS[option.status ?? "Active"]})</span>}
                </p>
                <p className="text-caption text-charcoal/60">
                  +{Number(option.charge ?? 0).toFixed(2)} · {AVAILABILITY_LABELS[option.availability ?? "Both"]}
                  {option.minQuantity ? ` · min ${option.minQuantity}` : ""}
                  {option.requiresManualReview ? " · manual review" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => openEdit(option)}>
                  Edit
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => handleDelete(option.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {itemForm && (
        <div className="space-y-3 rounded-md border border-border p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="packaging-option-method">Packaging method</Label>
              <Select value={itemForm.packagingMethodId} onValueChange={(value) => setItemForm((prev) => (prev ? { ...prev, packagingMethodId: value ?? "" } : prev))}>
                <SelectTrigger id="packaging-option-method">
                  <SelectValue>{(selected: string | null) => activeMethods.find((method) => method.id === selected)?.name ?? "Select a method"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {activeMethods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="packaging-option-variant">Applies to (optional)</Label>
              <Select value={itemForm.variantId ?? "__whole_product__"} onValueChange={(value) => setItemForm((prev) => (prev ? { ...prev, variantId: value === "__whole_product__" ? null : value } : prev))}>
                <SelectTrigger id="packaging-option-variant">
                  <SelectValue>{(selected: string | null) => (!selected || selected === "__whole_product__" ? "Whole product" : variants.find((variant) => variant.id === selected)?.name ?? "Whole product")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__whole_product__">Whole product</SelectItem>
                  {variants.map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {variant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="packaging-option-charge">Charge</Label>
              <Input
                id="packaging-option-charge"
                type="number"
                step="0.01"
                min={0}
                value={itemForm.charge ?? 0}
                onChange={(event) => setItemForm((prev) => (prev ? { ...prev, charge: Number(event.target.value) } : prev))}
              />
            </div>
            <div>
              <Label htmlFor="packaging-option-min-quantity">Minimum quantity (optional)</Label>
              <Input
                id="packaging-option-min-quantity"
                type="number"
                min={1}
                value={itemForm.minQuantity ?? ""}
                onChange={(event) => setItemForm((prev) => (prev ? { ...prev, minQuantity: event.target.value ? Number(event.target.value) : null } : prev))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="packaging-option-availability">Availability</Label>
              <Select value={itemForm.availability ?? "Both"} onValueChange={(value) => setItemForm((prev) => (prev ? { ...prev, availability: value as PackagingOptionFormInput["availability"] } : prev))}>
                <SelectTrigger id="packaging-option-availability">
                  <SelectValue>{(selected: string | null) => AVAILABILITY_LABELS[(selected ?? "Both") as (typeof AVAILABILITY_OPTIONS)[number]]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {AVAILABILITY_OPTIONS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {AVAILABILITY_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center pt-6">
              <CheckboxOption
                label="Requires manual review"
                checked={itemForm.requiresManualReview ?? false}
                onCheckedChange={(checked) => setItemForm((prev) => (prev ? { ...prev, requiresManualReview: checked } : prev))}
              />
            </div>
          </div>
          <p className="-mt-2 text-caption text-charcoal/60">An order containing this option is created as &quot;Pending confirmation&quot; instead of &quot;Confirmed&quot;, for an admin to review before it proceeds.</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="packaging-option-lead-time">Lead time (days, optional)</Label>
              <Input
                id="packaging-option-lead-time"
                type="number"
                min={0}
                value={itemForm.leadTimeDays ?? ""}
                onChange={(event) => setItemForm((prev) => (prev ? { ...prev, leadTimeDays: event.target.value ? Number(event.target.value) : null } : prev))}
              />
            </div>
            <div>
              <Label htmlFor="packaging-option-shelf-life-days">Shelf life (days, optional)</Label>
              <Input
                id="packaging-option-shelf-life-days"
                type="number"
                min={0}
                value={itemForm.shelfLifeDays ?? ""}
                onChange={(event) => setItemForm((prev) => (prev ? { ...prev, shelfLifeDays: event.target.value ? Number(event.target.value) : null } : prev))}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="packaging-option-shelf-life-text">Shelf life note (optional)</Label>
            <Input
              id="packaging-option-shelf-life-text"
              placeholder='e.g. "Best consumed within 2 weeks of packing"'
              value={itemForm.shelfLifeText ?? ""}
              onChange={(event) => setItemForm((prev) => (prev ? { ...prev, shelfLifeText: event.target.value } : prev))}
            />
          </div>

          <div>
            <Label htmlFor="packaging-option-instructions">Customer instructions (optional)</Label>
            <p className="-mt-1 mb-1 text-caption text-charcoal/60">One condition per line — shown to the customer as a numbered list.</p>
            <Textarea
              id="packaging-option-instructions"
              value={itemForm.customerInstructions ?? ""}
              onChange={(event) => setItemForm((prev) => (prev ? { ...prev, customerInstructions: event.target.value } : prev))}
            />
          </div>

          <div>
            <Label htmlFor="packaging-option-acknowledgement">Acknowledgement checkbox text (optional)</Label>
            <p className="-mt-1 mb-1 text-caption text-charcoal/60">
              What the customer confirms before adding this packaging to their cart. Leave blank to use the default wording.
            </p>
            <Input
              id="packaging-option-acknowledgement"
              placeholder="I understand this packaging's lead time and shelf life as described above."
              value={itemForm.acknowledgementText ?? ""}
              onChange={(event) => setItemForm((prev) => (prev ? { ...prev, acknowledgementText: event.target.value } : prev))}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="packaging-option-start-date">Available from (optional)</Label>
              <Input
                id="packaging-option-start-date"
                type="date"
                value={itemForm.availabilityStartDate ?? ""}
                onChange={(event) => setItemForm((prev) => (prev ? { ...prev, availabilityStartDate: event.target.value } : prev))}
              />
            </div>
            <div>
              <Label htmlFor="packaging-option-end-date">Available until (optional)</Label>
              <Input
                id="packaging-option-end-date"
                type="date"
                value={itemForm.availabilityEndDate ?? ""}
                onChange={(event) => setItemForm((prev) => (prev ? { ...prev, availabilityEndDate: event.target.value } : prev))}
              />
            </div>
            <div>
              <Label htmlFor="packaging-option-cutoff-date">Order cutoff (optional)</Label>
              <Input
                id="packaging-option-cutoff-date"
                type="date"
                value={itemForm.orderCutoffDate ?? ""}
                onChange={(event) => setItemForm((prev) => (prev ? { ...prev, orderCutoffDate: event.target.value } : prev))}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="packaging-option-status">Status</Label>
            <Select value={itemForm.status ?? "Active"} onValueChange={(value) => setItemForm((prev) => (prev ? { ...prev, status: value as PackagingOptionFormInput["status"] } : prev))}>
              <SelectTrigger id="packaging-option-status" className="w-full max-w-xs">
                <SelectValue>{(selected: string | null) => STATUS_LABELS[(selected ?? "Active") as (typeof STATUS_OPTIONS)[number]]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {STATUS_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button type="button" onClick={handleSave} disabled={!itemForm.packagingMethodId}>
              {editingId ? "Save option" : "Add option"}
            </Button>
            <Button type="button" variant="outline" onClick={closeForm}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
