"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type Dispatch, type SetStateAction } from "react";

import { AssetPickerDialog } from "@/components/admin/media/asset-picker-dialog";
import { BundleComponentPicker } from "@/components/admin/products/bundle-component-picker";
import { Button } from "@/components/ui/button";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  addBundleItem,
  createAdminBundle,
  deleteAdminBundle,
  deleteBundleItem,
  fetchAdminBundle,
  fetchBundlePreview,
  setBundleImages,
  updateAdminBundle,
  updateBundleItem,
  type BundleFormInput,
  type BundleItemFormInput,
} from "@/lib/api/admin-product-client";
import { toastManager } from "@/lib/toast";

const BUNDLE_TYPES = ["Fixed", "Selectable", "MixAndMatch"] as const;
const BUNDLE_TYPE_LABELS: Record<(typeof BUNDLE_TYPES)[number], string> = {
  Fixed: "Fixed (a locked set)",
  Selectable: "Selectable (pick one of several)",
  MixAndMatch: "Mix and match (pick several, within limits)",
};

const EMPTY_FORM: BundleFormInput = {
  bundleType: "Fixed",
  name: "",
  description: "",
  status: "Active",
  startDate: "",
  endDate: "",
  discountType: null,
  fixedPrice: null,
  percentOff: null,
  amountOff: null,
  minQuantity: null,
  maxQuantity: null,
  stockMode: "Derived",
  stockQuantity: null,
  inStock: true,
};

interface AdminBundleItem {
  id: string;
  componentProductId: string;
  componentVariantId: string | null;
  componentProduct: { name: string };
  componentVariant: { name: string } | null;
  quantity: number;
  isRequired: boolean;
  minQuantity: number;
  maxQuantity: number | null;
}

interface AdminBundle {
  id: string;
  bundleType: BundleFormInput["bundleType"];
  name: string;
  description: string | null;
  status: "Active" | "Inactive";
  startDate: string | null;
  endDate: string | null;
  discountType: BundleFormInput["discountType"];
  fixedPrice: string | number | null;
  percentOff: string | number | null;
  amountOff: string | number | null;
  minQuantity: number | null;
  maxQuantity: number | null;
  stockMode: BundleFormInput["stockMode"];
  stockQuantity: number | null;
  inStock: boolean;
  items: AdminBundleItem[];
  images: { url: string }[];
}

function mapBundleToForm(bundle: AdminBundle): BundleFormInput {
  return {
    bundleType: bundle.bundleType,
    name: bundle.name,
    description: bundle.description ?? "",
    status: bundle.status,
    startDate: bundle.startDate ? bundle.startDate.slice(0, 10) : "",
    endDate: bundle.endDate ? bundle.endDate.slice(0, 10) : "",
    discountType: bundle.discountType,
    fixedPrice: bundle.fixedPrice ? Number(bundle.fixedPrice) : null,
    percentOff: bundle.percentOff ? Number(bundle.percentOff) : null,
    amountOff: bundle.amountOff ? Number(bundle.amountOff) : null,
    minQuantity: bundle.minQuantity,
    maxQuantity: bundle.maxQuantity,
    stockMode: bundle.stockMode,
    stockQuantity: bundle.stockQuantity,
    inStock: bundle.inStock,
  };
}

/**
 * Self-contained Bundle tab panel, mirroring ProductVariantsPanel's own
 * shape exactly: own useQuery, own invalidateQueries, "save the bundle
 * first" guard for items, plain async handlers with local error state.
 */
export function ProductBundlePanel({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  const { data: bundle, isLoading } = useQuery({ queryKey: ["admin-bundle", productId], queryFn: () => fetchAdminBundle(productId) });

  const [createForm, setCreateForm] = useState<BundleFormInput>(EMPTY_FORM);
  const [createError, setCreateError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-bundle", productId] });
    queryClient.invalidateQueries({ queryKey: ["admin-bundle-preview", productId] });
  }

  async function handleCreateBundle() {
    setCreateError(null);
    try {
      await createAdminBundle(productId, createForm);
      toastManager.add({ title: "Bundle created" });
      invalidate();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create bundle.");
    }
  }

  if (isLoading) return <p className="text-body text-charcoal/70">Loading bundle…</p>;

  if (!bundle) {
    return (
      <div className="space-y-4">
        <p className="text-small text-charcoal/70">This product has no bundle configured yet. Set it up below — once saved, add components beneath.</p>
        {createError && <p className="text-small text-destructive">{createError}</p>}
        <BundleFormFields form={createForm} setForm={setCreateForm} />
        <Button type="button" onClick={handleCreateBundle} disabled={!createForm.name.trim()}>
          Create bundle
        </Button>
      </div>
    );
  }

  return <ExistingBundlePanel productId={productId} bundle={bundle} invalidate={invalidate} />;
}

/**
 * Mounted only once a bundle exists — its form state initializes directly
 * from `bundle` via a lazy useState initializer (no effect/setState-sync
 * needed: this component only mounts after the "no bundle yet" branch
 * above has already returned, and a later refetch from invalidate() must
 * NOT clobber an admin's in-progress, unsaved edits here, same as
 * ProductVariantsPanel's own local-form-state independence from refetches).
 */
function ExistingBundlePanel({ productId, bundle, invalidate }: { productId: string; bundle: AdminBundle; invalidate: () => void }) {
  const { data: preview } = useQuery({ queryKey: ["admin-bundle-preview", productId], queryFn: () => fetchBundlePreview(productId) });

  const [form, setForm] = useState<BundleFormInput>(() => mapBundleToForm(bundle));
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [itemForm, setItemForm] = useState<BundleItemFormInput | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  async function handleSaveBundle() {
    setError(null);
    try {
      await updateAdminBundle(productId, form);
      toastManager.add({ title: "Bundle saved" });
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save bundle.");
    }
  }

  async function handleDeleteBundle() {
    setError(null);
    try {
      await deleteAdminBundle(productId);
      toastManager.add({ title: "Bundle removed" });
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove bundle.");
    }
  }

  function openAddItem(componentProductId: string, componentVariantId: string | null) {
    setEditingItemId(null);
    setItemForm({ componentProductId, componentVariantId, quantity: 1, isRequired: form.bundleType === "Fixed", minQuantity: 0, maxQuantity: null, sortOrder: 0 });
  }

  function openEditItem(item: AdminBundleItem) {
    setEditingItemId(item.id);
    setItemForm({
      componentProductId: item.componentProductId,
      componentVariantId: item.componentVariantId,
      quantity: item.quantity,
      isRequired: item.isRequired,
      minQuantity: item.minQuantity,
      maxQuantity: item.maxQuantity,
      sortOrder: 0,
    });
  }

  async function handleSaveItem() {
    if (!itemForm) return;
    setError(null);
    try {
      if (editingItemId) {
        await updateBundleItem(productId, editingItemId, itemForm);
      } else {
        await addBundleItem(productId, itemForm);
      }
      setItemForm(null);
      setEditingItemId(null);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save bundle item.");
    }
  }

  async function handleDeleteItem(itemId: string) {
    setError(null);
    try {
      await deleteBundleItem(productId, itemId);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove bundle item.");
    }
  }

  const items: AdminBundleItem[] = bundle.items ?? [];

  return (
    <div className="space-y-8">
      {error && <p className="text-small text-destructive">{error}</p>}

      <section className="space-y-3">
        <BundleFormFields form={form} setForm={setForm} />
        <div className="flex items-center gap-2">
          <Button type="button" onClick={handleSaveBundle} disabled={!form.name.trim()}>
            Save bundle
          </Button>
          <Button type="button" variant="ghost" onClick={handleDeleteBundle}>
            Remove bundle
          </Button>
        </div>
        {preview && (
          <p className="text-small text-charcoal/70">
            Original price <span className="font-number">{preview.standaloneTotal}</span> → bundle price{" "}
            <span className="font-number font-medium text-charcoal">{preview.discountedTotal}</span>
            {Number(preview.savings) > 0 && <span className="ml-1 text-leaf-dark">(save {preview.savings})</span>}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-small font-medium text-charcoal">Components</h3>
          <BundleComponentPicker onSelect={openAddItem} />
        </div>

        {items.length === 0 ? (
          <p className="text-small text-charcoal/70">No components yet — add at least one above.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="text-small font-medium text-charcoal">
                    {item.componentProduct.name}
                    {item.componentVariant && <span className="text-charcoal/70"> — {item.componentVariant.name}</span>}
                  </p>
                  <p className="text-caption text-charcoal/60">
                    Qty {item.quantity}
                    {form.bundleType !== "Fixed" && ` · ${item.isRequired ? "Required" : "Optional"} · min ${item.minQuantity}${item.maxQuantity ? `, max ${item.maxQuantity}` : ""}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => openEditItem(item)}>
                    Edit
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => handleDeleteItem(item.id)}>
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
                <Label htmlFor="bundle-item-quantity">Quantity</Label>
                <Input
                  id="bundle-item-quantity"
                  type="number"
                  min={1}
                  value={itemForm.quantity}
                  onChange={(event) => setItemForm((prev) => (prev ? { ...prev, quantity: Number(event.target.value) } : prev))}
                />
              </div>
              {form.bundleType !== "Fixed" && (
                <div className="flex items-center pt-6">
                  <CheckboxOption
                    label="Required"
                    checked={itemForm.isRequired ?? false}
                    onCheckedChange={(checked) => setItemForm((prev) => (prev ? { ...prev, isRequired: checked } : prev))}
                  />
                </div>
              )}
            </div>
            {form.bundleType !== "Fixed" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="bundle-item-min">Min selectable</Label>
                  <Input
                    id="bundle-item-min"
                    type="number"
                    min={0}
                    value={itemForm.minQuantity ?? 0}
                    onChange={(event) => setItemForm((prev) => (prev ? { ...prev, minQuantity: Number(event.target.value) } : prev))}
                  />
                </div>
                <div>
                  <Label htmlFor="bundle-item-max">Max selectable (optional)</Label>
                  <Input
                    id="bundle-item-max"
                    type="number"
                    min={0}
                    value={itemForm.maxQuantity ?? ""}
                    onChange={(event) => setItemForm((prev) => (prev ? { ...prev, maxQuantity: event.target.value ? Number(event.target.value) : null } : prev))}
                  />
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button type="button" onClick={handleSaveItem}>
                {editingItemId ? "Save component" : "Add component"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setItemForm(null);
                  setEditingItemId(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </section>

      <section>
        <Label>Bundle images</Label>
        <div className="mt-1 flex items-center gap-2">
          {bundle.images?.[0] && (
            // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail only, not a storefront image
            <img src={bundle.images[0].url} alt="" className="h-12 w-12 rounded object-cover" />
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
            Browse Library
          </Button>
        </div>
        <p className="mt-1 text-caption text-charcoal/60">Optional — falls back to the product&apos;s own images when not set.</p>
      </section>

      <AssetPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={async (asset) => {
          try {
            await setBundleImages(productId, [{ url: asset.url, altText: asset.altText, isPrimary: true }]);
            invalidate();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save the bundle image.");
          }
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

function BundleFormFields({ form, setForm }: { form: BundleFormInput; setForm: Dispatch<SetStateAction<BundleFormInput>> }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="bundle-name">Name</Label>
          <Input id="bundle-name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
        </div>
        <div>
          <Label htmlFor="bundle-type">Type</Label>
          <Select value={form.bundleType} onValueChange={(value) => setForm((prev) => ({ ...prev, bundleType: value as BundleFormInput["bundleType"] }))}>
            <SelectTrigger id="bundle-type">
              <SelectValue>{(selected: string | null) => BUNDLE_TYPE_LABELS[(selected ?? "Fixed") as (typeof BUNDLE_TYPES)[number]]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {BUNDLE_TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {BUNDLE_TYPE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="bundle-description">Description (optional)</Label>
        <Textarea id="bundle-description" value={form.description ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
      </div>

      {form.bundleType !== "Fixed" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="bundle-min-quantity">Min items to select (optional)</Label>
            <Input
              id="bundle-min-quantity"
              type="number"
              min={0}
              value={form.minQuantity ?? ""}
              onChange={(event) => setForm((prev) => ({ ...prev, minQuantity: event.target.value ? Number(event.target.value) : null }))}
            />
          </div>
          <div>
            <Label htmlFor="bundle-max-quantity">Max items to select (optional)</Label>
            <Input
              id="bundle-max-quantity"
              type="number"
              min={0}
              value={form.maxQuantity ?? ""}
              onChange={(event) => setForm((prev) => ({ ...prev, maxQuantity: event.target.value ? Number(event.target.value) : null }))}
            />
          </div>
        </div>
      )}

      <div>
        <Label>Discount</Label>
        <div className="mt-1 grid grid-cols-3 gap-3">
          <Input
            type="number"
            step="0.01"
            placeholder="Fixed price"
            value={form.discountType === "FixedPrice" ? form.fixedPrice ?? "" : ""}
            onChange={(event) => setForm((prev) => ({ ...prev, discountType: event.target.value ? "FixedPrice" : null, fixedPrice: event.target.value ? Number(event.target.value) : null, percentOff: null, amountOff: null }))}
          />
          <Input
            type="number"
            step="0.01"
            placeholder="% off"
            value={form.discountType === "PercentageOff" ? form.percentOff ?? "" : ""}
            onChange={(event) => setForm((prev) => ({ ...prev, discountType: event.target.value ? "PercentageOff" : null, percentOff: event.target.value ? Number(event.target.value) : null, fixedPrice: null, amountOff: null }))}
          />
          <Input
            type="number"
            step="0.01"
            placeholder="Amount off"
            value={form.discountType === "FixedAmountOff" ? form.amountOff ?? "" : ""}
            onChange={(event) => setForm((prev) => ({ ...prev, discountType: event.target.value ? "FixedAmountOff" : null, amountOff: event.target.value ? Number(event.target.value) : null, fixedPrice: null, percentOff: null }))}
          />
        </div>
        <p className="mt-1 text-caption text-charcoal/60">Leave all three blank for no discount — priced as the sum of its components.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="bundle-start-date">Start date (optional)</Label>
          <Input id="bundle-start-date" type="date" value={form.startDate ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} />
        </div>
        <div>
          <Label htmlFor="bundle-end-date">End date (optional)</Label>
          <Input id="bundle-end-date" type="date" value={form.endDate ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))} />
        </div>
      </div>
      <p className="text-caption text-charcoal/60">Leave both blank for an always-on bundle, or set one or both for a seasonal window.</p>

      <div className="flex items-center gap-6">
        <CheckboxOption label="Active" checked={form.status !== "Inactive"} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, status: checked ? "Active" : "Inactive" }))} />
      </div>

      <div>
        <Label htmlFor="bundle-stock-mode">Stock</Label>
        <Select value={form.stockMode ?? "Derived"} onValueChange={(value) => setForm((prev) => ({ ...prev, stockMode: value as BundleFormInput["stockMode"] }))}>
          <SelectTrigger id="bundle-stock-mode">
            <SelectValue>{(selected: string | null) => (selected === "OwnStock" ? "Its own stock count" : "Computed from its components")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Derived">Computed from its components</SelectItem>
            <SelectItem value="OwnStock">Its own stock count</SelectItem>
          </SelectContent>
        </Select>
        {form.stockMode === "OwnStock" && (
          <div className="mt-2 flex items-center gap-4">
            <Input
              type="number"
              min={0}
              className="w-32"
              value={form.stockQuantity ?? 0}
              onChange={(event) => setForm((prev) => ({ ...prev, stockQuantity: Number(event.target.value) }))}
            />
            <CheckboxOption label="In stock" checked={form.inStock ?? true} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, inStock: checked }))} />
          </div>
        )}
      </div>
    </div>
  );
}
