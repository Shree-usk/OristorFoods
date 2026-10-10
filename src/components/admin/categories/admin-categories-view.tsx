"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AssetPickerDialog } from "@/components/admin/media/asset-picker-dialog";
import {
  createAdminCategory,
  fetchAdminCategories,
  updateAdminCategory,
  type AdminCategory,
  type CategoryAdminInput,
} from "@/lib/api/admin-category-client";
import { toastManager } from "@/lib/toast";

const EMPTY_FORM: CategoryAdminInput = {
  name: "",
  slug: "",
  description: "",
  image: "",
  status: "Active",
  parentId: null,
  metaTitle: "",
  metaDescription: "",
  canonicalUrl: "",
  ogImage: "",
};

/** Flattens the tree into (node, depth) pairs for a simple indented table — categories are only 2 levels deep (parentId/children), so this never needs a collapsible tree widget. */
function flatten(nodes: AdminCategory[], depth = 0): { node: AdminCategory; depth: number }[] {
  return nodes.flatMap((node) => [{ node, depth }, ...flatten(node.children, depth + 1)]);
}

export function AdminCategoriesView() {
  const queryClient = useQueryClient();
  const { data: tree, isLoading } = useQuery({ queryKey: ["admin-categories"], queryFn: fetchAdminCategories });

  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [creatingUnderParentId, setCreatingUnderParentId] = useState<string | null | undefined>(undefined);
  const [form, setForm] = useState<CategoryAdminInput>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [imagePickerTarget, setImagePickerTarget] = useState<"image" | "ogImage" | null>(null);

  const dialogOpen = editing !== null || creatingUnderParentId !== undefined;
  const rows = tree ? flatten(tree) : [];
  const allCategoriesFlat = tree ? flatten(tree).map((row) => row.node) : [];

  function openCreate(parentId: string | null) {
    setForm({ ...EMPTY_FORM, parentId });
    setCreatingUnderParentId(parentId);
    setEditing(null);
    setError(null);
  }

  function openEdit(category: AdminCategory) {
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      image: category.image ?? "",
      sortOrder: category.sortOrder,
      status: category.status,
      parentId: category.parentId,
      metaTitle: category.metaTitle ?? "",
      metaDescription: category.metaDescription ?? "",
      canonicalUrl: category.canonicalUrl ?? "",
      ogImage: category.ogImage ?? "",
    });
    setEditing(category);
    setCreatingUnderParentId(undefined);
    setError(null);
  }

  function closeDialog() {
    setEditing(null);
    setCreatingUnderParentId(undefined);
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    try {
      if (editing) {
        await updateAdminCategory(editing.id, form);
        toastManager.add({ title: "Category saved" });
      } else {
        await createAdminCategory(form);
        toastManager.add({ title: "Category created" });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      closeDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save category.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleStatus(category: AdminCategory) {
    try {
      await updateAdminCategory(category.id, { status: category.status === "Active" ? "Inactive" : "Active" });
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    } catch {
      toastManager.add({ title: "Failed to update status" });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-heading text-charcoal">Categories</h1>
        <Button type="button" onClick={() => openCreate(null)}>
          Add category
        </Button>
      </div>
      <p className="mt-1 text-small text-charcoal/70">
        Active categories with an image appear in the homepage&apos;s &quot;Shop by Category&quot; section, ordered by sort order.
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
                <TableHead>Status</TableHead>
                <TableHead>Sort order</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-small text-charcoal/70">
                    No categories yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map(({ node, depth }) => (
                  <TableRow key={node.id}>
                    <TableCell style={{ paddingLeft: `${depth * 24 + 16}px` }}>{node.name}</TableCell>
                    <TableCell>{node.slug}</TableCell>
                    <TableCell>{node.image ? "✓" : "—"}</TableCell>
                    <TableCell>
                      <CheckboxOption label={node.status} checked={node.status === "Active"} onCheckedChange={() => toggleStatus(node)} />
                    </TableCell>
                    <TableCell>{node.sortOrder}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(node)}>
                          Edit
                        </Button>
                        {depth === 0 && (
                          <Button type="button" size="sm" variant="ghost" onClick={() => openCreate(node.id)}>
                            Add subcategory
                          </Button>
                        )}
                      </div>
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
          <h2 className="text-h3 font-heading text-charcoal">{editing ? "Edit category" : "Add category"}</h2>
          <div className="mt-4 flex flex-col gap-3">
            <div>
              <Label htmlFor="category-name">Name</Label>
              <Input id="category-name" value={form.name ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="category-slug">Slug</Label>
              <Input id="category-slug" value={form.slug ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="category-description">Description</Label>
              <Textarea id="category-description" value={form.description ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="category-image">Image</Label>
              <div className="flex gap-2">
                <Input id="category-image" value={form.image ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, image: event.target.value }))} className="flex-1" />
                <Button type="button" size="sm" variant="outline" onClick={() => setImagePickerTarget("image")}>
                  Browse Library
                </Button>
              </div>
              <p className="mt-1 text-caption text-charcoal/60">
                Shown square on the homepage — a roughly square image (e.g. 800×800px) works best.
              </p>
            </div>
            <div>
              <Label htmlFor="category-parent">Parent category</Label>
              <Select
                value={form.parentId ?? "none"}
                onValueChange={(value) => setForm((prev) => ({ ...prev, parentId: value === "none" ? null : value }))}
              >
                <SelectTrigger id="category-parent" className="w-full">
                  <SelectValue>{(selected: string | null) => (selected && selected !== "none" ? allCategoriesFlat.find((c) => c.id === selected)?.name ?? "None (top level)" : "None (top level)")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top level)</SelectItem>
                  {allCategoriesFlat
                    .filter((category) => category.id !== editing?.id)
                    .map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="category-sort-order">Sort order</Label>
                <Input
                  id="category-sort-order"
                  type="number"
                  value={form.sortOrder ?? ""}
                  onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value === "" ? undefined : Number(event.target.value) }))}
                />
              </div>
              <div className="pt-6">
                <StatusToggle value={form.status} onChange={(status) => setForm((prev) => ({ ...prev, status }))} />
              </div>
            </div>

            <h3 className="mt-2 text-small font-medium text-charcoal">SEO (optional)</h3>
            <div>
              <Label htmlFor="category-meta-title">Meta title</Label>
              <Input id="category-meta-title" value={form.metaTitle ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, metaTitle: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="category-meta-description">Meta description</Label>
              <Textarea id="category-meta-description" value={form.metaDescription ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, metaDescription: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="category-canonical-url">Canonical URL</Label>
              <Input id="category-canonical-url" value={form.canonicalUrl ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, canonicalUrl: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="category-og-image">Social share image</Label>
              <div className="flex gap-2">
                <Input id="category-og-image" value={form.ogImage ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, ogImage: event.target.value }))} className="flex-1" />
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
function StatusToggle({ value, onChange }: { value: CategoryAdminInput["status"]; onChange: (status: "Active" | "Inactive") => void }) {
  return <CheckboxOption label="Active" checked={value !== "Inactive"} onCheckedChange={(checked) => onChange(checked ? "Active" : "Inactive")} />;
}
