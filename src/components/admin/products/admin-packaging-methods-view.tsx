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
import {
  createAdminPackagingMethod,
  fetchAdminPackagingMethods,
  updateAdminPackagingMethod,
  type AdminPackagingMethod,
  type PackagingMethodAdminInput,
} from "@/lib/api/admin-packaging-method-client";
import { toastManager } from "@/lib/toast";

const EMPTY_FORM: PackagingMethodAdminInput = {
  name: "",
  description: "",
  image: "",
  status: "Active",
};

export function AdminPackagingMethodsView() {
  const queryClient = useQueryClient();
  const { data: methods, isLoading } = useQuery({ queryKey: ["admin-packaging-methods"], queryFn: fetchAdminPackagingMethods });

  const [editing, setEditing] = useState<AdminPackagingMethod | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<PackagingMethodAdminInput>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);

  const dialogOpen = editing !== null || creating;

  function openCreate() {
    setForm(EMPTY_FORM);
    setCreating(true);
    setEditing(null);
    setError(null);
  }

  function openEdit(method: AdminPackagingMethod) {
    setForm({
      name: method.name,
      description: method.description ?? "",
      image: method.image ?? "",
      status: method.status,
    });
    setEditing(method);
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
        await updateAdminPackagingMethod(editing.id, form);
        toastManager.add({ title: "Packaging method saved" });
      } else {
        await createAdminPackagingMethod(form);
        toastManager.add({ title: "Packaging method created" });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-packaging-methods"] });
      closeDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save packaging method.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleStatus(method: AdminPackagingMethod) {
    try {
      await updateAdminPackagingMethod(method.id, { status: method.status === "Active" ? "Inactive" : "Active" });
      queryClient.invalidateQueries({ queryKey: ["admin-packaging-methods"] });
    } catch {
      toastManager.add({ title: "Failed to update status" });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-heading text-charcoal">Packaging methods</h1>
        <Button type="button" onClick={openCreate}>
          Add packaging method
        </Button>
      </div>
      <p className="mt-1 text-small text-charcoal/70">
        Global packaging options (e.g. &quot;Vacuum Pouch&quot;, &quot;Foil Pouch&quot;) a product can offer. Charge,
        availability, minimum quantity, lead time, and shelf life are configured per product on each product&apos;s
        own Packaging tab — this list only holds the shared name, description, and image.
      </p>

      <div className="mt-6">
        {isLoading ? (
          <p className="text-small text-charcoal/70">Loading…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Image</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!methods || methods.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-small text-charcoal/70">
                    No packaging methods yet.
                  </TableCell>
                </TableRow>
              ) : (
                methods.map((method) => (
                  <TableRow key={method.id}>
                    <TableCell>{method.name}</TableCell>
                    <TableCell className="max-w-xs truncate">{method.description ?? "—"}</TableCell>
                    <TableCell>
                      {method.image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail only, URL can be external (typed directly, not only Media Library)
                        <img src={method.image} alt="" className="size-8 rounded object-cover" />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <CheckboxOption label={method.status} checked={method.status === "Active"} onCheckedChange={() => toggleStatus(method)} />
                    </TableCell>
                    <TableCell>
                      <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(method)}>
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
          <h2 className="text-h3 font-heading text-charcoal">{editing ? "Edit packaging method" : "Add packaging method"}</h2>
          <div className="mt-4 flex flex-col gap-3">
            <div>
              <Label htmlFor="packaging-method-name">Name</Label>
              <Input id="packaging-method-name" value={form.name ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="packaging-method-description">Description</Label>
              <Textarea id="packaging-method-description" value={form.description ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="packaging-method-image">Image</Label>
              <p className="-mt-1 mb-1 text-caption text-charcoal/60">Shown as a small icon next to this packaging on the product page.</p>
              <div className="flex items-center gap-2">
                {form.image && (
                  // eslint-disable-next-line @next/next/no-img-element -- admin preview only, URL can be external (typed directly, not only Media Library)
                  <img src={form.image} alt="" className="size-10 shrink-0 rounded object-cover" />
                )}
                <Input id="packaging-method-image" value={form.image ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, image: event.target.value }))} className="flex-1" />
                <Button type="button" size="sm" variant="outline" onClick={() => setImagePickerOpen(true)}>
                  Browse Library
                </Button>
              </div>
            </div>
            <div className="pt-1">
              <CheckboxOption label="Active" checked={form.status !== "Inactive"} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, status: checked ? "Active" : "Inactive" }))} />
            </div>

            {error && <p className="text-small text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" onClick={handleSave} disabled={isSaving || !form.name?.trim()}>
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
        open={imagePickerOpen}
        onOpenChange={setImagePickerOpen}
        onSelect={(asset) => {
          setForm((prev) => ({ ...prev, image: asset.url }));
          setImagePickerOpen(false);
        }}
      />
    </div>
  );
}
