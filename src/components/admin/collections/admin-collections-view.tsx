"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AssetPickerDialog } from "@/components/admin/media/asset-picker-dialog";
// Generic multi-select product picker (search-as-you-type + removable
// chips) — built for coupon scoping but has no coupon-specific logic,
// reused here instead of a third near-duplicate implementation.
import { CouponScopeProductPicker } from "@/components/admin/marketing/coupon-scope-product-picker";
import {
  createAdminCollection,
  fetchAdminCollections,
  updateAdminCollection,
  type AdminCollection,
  type CollectionAdminInput,
} from "@/lib/api/admin-collection-client";
import { toastManager } from "@/lib/toast";

const EMPTY_FORM: CollectionAdminInput = {
  name: "",
  slug: "",
  description: "",
  image: "",
  status: "Active",
  startDate: "",
  endDate: "",
  metaTitle: "",
  metaDescription: "",
  canonicalUrl: "",
  ogImage: "",
  showOnExportPage: false,
  isExportFeatured: false,
  exportDisplayOrder: 0,
  productIds: [],
};

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export function AdminCollectionsView() {
  const queryClient = useQueryClient();
  const { data: collections, isLoading } = useQuery({ queryKey: ["admin-collections"], queryFn: fetchAdminCollections });

  const [editing, setEditing] = useState<AdminCollection | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CollectionAdminInput>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [imagePickerTarget, setImagePickerTarget] = useState<"image" | "ogImage" | null>(null);

  const dialogOpen = editing !== null || creating;

  function openCreate() {
    setForm(EMPTY_FORM);
    setCreating(true);
    setEditing(null);
    setError(null);
  }

  function openEdit(collection: AdminCollection) {
    setForm({
      name: collection.name,
      slug: collection.slug,
      description: collection.description ?? "",
      image: collection.image ?? "",
      status: collection.status,
      startDate: toDateInputValue(collection.startDate),
      endDate: toDateInputValue(collection.endDate),
      metaTitle: collection.metaTitle ?? "",
      metaDescription: collection.metaDescription ?? "",
      canonicalUrl: collection.canonicalUrl ?? "",
      ogImage: collection.ogImage ?? "",
      showOnExportPage: collection.showOnExportPage,
      isExportFeatured: collection.isExportFeatured,
      exportDisplayOrder: collection.exportDisplayOrder,
      productIds: collection.products.map((product) => product.id),
    });
    setEditing(collection);
    setCreating(false);
    setError(null);
  }

  function closeDialog() {
    setEditing(null);
    setCreating(false);
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    try {
      if (editing) {
        await updateAdminCollection(editing.id, form);
        toastManager.add({ title: "Collection saved" });
      } else {
        await createAdminCollection(form);
        toastManager.add({ title: "Collection created" });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-collections"] });
      closeDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save collection.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleStatus(collection: AdminCollection) {
    try {
      await updateAdminCollection(collection.id, { status: collection.status === "Active" ? "Inactive" : "Active" });
      queryClient.invalidateQueries({ queryKey: ["admin-collections"] });
    } catch {
      toastManager.add({ title: "Failed to update status" });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-heading text-charcoal">Collections</h1>
        <Button type="button" onClick={openCreate}>
          Add collection
        </Button>
      </div>
      <p className="mt-1 text-small text-charcoal/70">
        Active collections with an image, inside their start/end date window (or with no dates set, meaning always
        on), appear in the homepage&apos;s &quot;Product Collections&quot; section.
      </p>

      <div className="mt-6">
        {isLoading ? (
          <p className="text-small text-charcoal/70">Loading…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Image</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!collections || collections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-small text-charcoal/70">
                    No collections yet.
                  </TableCell>
                </TableRow>
              ) : (
                collections.map((collection) => (
                  <TableRow key={collection.id}>
                    <TableCell>{collection.name}</TableCell>
                    <TableCell>{collection.slug}</TableCell>
                    <TableCell>{collection.image ? "✓" : "—"}</TableCell>
                    <TableCell>
                      {collection.startDate || collection.endDate
                        ? `${toDateInputValue(collection.startDate) || "…"} – ${toDateInputValue(collection.endDate) || "…"}`
                        : "Always on"}
                    </TableCell>
                    <TableCell>
                      <CheckboxOption label={collection.status} checked={collection.status === "Active"} onCheckedChange={() => toggleStatus(collection)} />
                    </TableCell>
                    <TableCell>
                      <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(collection)}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <h2 className="text-h3 font-heading text-charcoal">{editing ? "Edit collection" : "Add collection"}</h2>
          <div className="mt-4 flex flex-col gap-3">
            <div>
              <Label htmlFor="collection-name">Name</Label>
              <Input id="collection-name" value={form.name ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="collection-slug">Slug</Label>
              <Input id="collection-slug" value={form.slug ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="collection-description">Description</Label>
              <Textarea id="collection-description" value={form.description ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="collection-image">Image</Label>
              <div className="flex gap-2">
                <Input id="collection-image" value={form.image ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, image: event.target.value }))} className="flex-1" />
                <Button type="button" size="sm" variant="outline" onClick={() => setImagePickerTarget("image")}>
                  Browse Library
                </Button>
              </div>
              <p className="mt-1 text-caption text-charcoal/60">
                Use a landscape photo, at least 1200×900px (4:3) — it&apos;s cropped to a 4:3 tile across 3 columns on
                desktop (1 column on mobile), so keep the main subject centered. A tall or product-packaging-style
                photo will look cropped here.
              </p>
            </div>
            <div>
              <Label>Products in this collection</Label>
              <CouponScopeProductPicker
                value={form.productIds ?? []}
                onChange={(productIds) => setForm((prev) => ({ ...prev, productIds }))}
              />
              <p className="mt-1 text-caption text-charcoal/60">
                The products a customer sees when they click through from this collection&apos;s card — e.g. every
                item in a gift set, not just one.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="collection-start-date">Start date (optional)</Label>
                <Input id="collection-start-date" type="date" value={form.startDate ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} />
              </div>
              <div>
                <Label htmlFor="collection-end-date">End date (optional)</Label>
                <Input id="collection-end-date" type="date" value={form.endDate ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))} />
              </div>
            </div>
            <p className="-mt-2 text-caption text-charcoal/60">
              Leave both blank for an always-on collection, or set one or both for a seasonal window (e.g. a holiday
              gift collection).
            </p>
            <div className="pt-1">
              <StatusToggle value={form.status} onChange={(status) => setForm((prev) => ({ ...prev, status }))} />
            </div>

            <h3 className="mt-2 text-small font-medium text-charcoal">Export & Wholesale (optional)</h3>
            <div className="pt-1">
              <CheckboxOption
                label="Show on Export & Wholesale page"
                checked={form.showOnExportPage ?? false}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, showOnExportPage: checked }))}
              />
              <p className="mt-1 text-caption text-charcoal/60">Off by default — a seasonal/homepage collection never silently appears on the B2B export page.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="pt-6">
                <CheckboxOption
                  label="Featured on export page"
                  checked={form.isExportFeatured ?? false}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isExportFeatured: checked }))}
                />
              </div>
              <div>
                <Label htmlFor="collection-export-order">Export display order</Label>
                <Input
                  id="collection-export-order"
                  type="number"
                  value={form.exportDisplayOrder ?? 0}
                  onChange={(event) => setForm((prev) => ({ ...prev, exportDisplayOrder: event.target.value === "" ? 0 : Number(event.target.value) }))}
                />
              </div>
            </div>

            <h3 className="mt-2 text-small font-medium text-charcoal">SEO (optional)</h3>
            <div>
              <Label htmlFor="collection-meta-title">Meta title</Label>
              <Input id="collection-meta-title" value={form.metaTitle ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, metaTitle: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="collection-meta-description">Meta description</Label>
              <Textarea id="collection-meta-description" value={form.metaDescription ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, metaDescription: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="collection-canonical-url">Canonical URL</Label>
              <Input id="collection-canonical-url" value={form.canonicalUrl ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, canonicalUrl: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="collection-og-image">Social share image</Label>
              <div className="flex gap-2">
                <Input id="collection-og-image" value={form.ogImage ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, ogImage: event.target.value }))} className="flex-1" />
                <Button type="button" size="sm" variant="outline" onClick={() => setImagePickerTarget("ogImage")}>
                  Browse Library
                </Button>
              </div>
            </div>

            {error && <p className="text-small text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" onClick={handleSave} disabled={isSaving || !form.name?.trim() || !form.slug?.trim()}>
                {isSaving ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AssetPickerDialog
        open={imagePickerTarget !== null}
        onOpenChange={(open) => !open && setImagePickerTarget(null)}
        onSelect={(asset) => {
          if (!imagePickerTarget) return;
          setForm((prev) => ({ ...prev, [imagePickerTarget]: asset.url }));
          setImagePickerTarget(null);
        }}
      />
    </div>
  );
}

/** A plain Active/Inactive toggle — kept local since it's a 2-value, non-reference-data enum unlike the other Select fields here. */
function StatusToggle({ value, onChange }: { value: CollectionAdminInput["status"]; onChange: (status: "Active" | "Inactive") => void }) {
  return <CheckboxOption label="Active" checked={value !== "Inactive"} onCheckedChange={(checked) => onChange(checked ? "Active" : "Inactive")} />;
}
