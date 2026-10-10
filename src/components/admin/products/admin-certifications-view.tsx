"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AssetPickerDialog } from "@/components/admin/media/asset-picker-dialog";
import {
  createAdminAllergen,
  createAdminCertification,
  fetchAdminAllergens,
  fetchAdminCertifications,
  updateAdminAllergen,
  updateAdminCertification,
  type AdminAllergen,
  type AdminCertification,
} from "@/lib/api/admin-product-taxonomy-client";
import { toastManager } from "@/lib/toast";

const EMPTY_ALLERGEN = { name: "", icon: "" };
const EMPTY_CERTIFICATION = { name: "", certificateImage: "", documentUrl: "" };

/** Flat reference tables (no hierarchy, unlike Category) — picked via checkbox on the Product admin form's Nutrition & Ingredients tab. */
export function AdminCertificationsView() {
  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">Allergens &amp; Certifications</h1>
      <p className="mt-1 text-small text-charcoal/70">
        These populate the Allergens and Certifications checklists on the Product admin form, and the badges shown on each
        product&apos;s page.
      </p>
      <div className="mt-6">
        <AllergensPanel />
      </div>
      <div className="mt-10">
        <CertificationsPanel />
      </div>
    </div>
  );
}

function AllergensPanel() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-allergens"], queryFn: fetchAdminAllergens });
  const [newAllergen, setNewAllergen] = useState(EMPTY_ALLERGEN);
  const [error, setError] = useState<string | null>(null);
  const [iconPickerFor, setIconPickerFor] = useState<string | "new" | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-allergens"] });
  }

  async function handleAdd() {
    setError(null);
    try {
      await createAdminAllergen({ name: newAllergen.name, icon: newAllergen.icon || null });
      setNewAllergen(EMPTY_ALLERGEN);
      toastManager.add({ title: "Allergen added" });
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add allergen.");
    }
  }

  async function handleSave(allergen: AdminAllergen, name: string, icon: string) {
    setError(null);
    try {
      await updateAdminAllergen(allergen.id, { name, icon: icon || null });
      toastManager.add({ title: "Allergen saved" });
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save allergen.");
    }
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-h4 font-heading text-charcoal">Allergens</h2>
      {error && <p className="mt-1 text-small text-destructive">{error}</p>}
      <Table className="mt-2">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Icon</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data ?? []).map((allergen) => (
            <AllergenRow key={allergen.id} allergen={allergen} onSave={handleSave} onBrowseIcon={() => setIconPickerFor(allergen.id)} />
          ))}
          <TableRow>
            <TableCell>
              <Input placeholder="e.g. Shellfish" value={newAllergen.name} onChange={(event) => setNewAllergen((prev) => ({ ...prev, name: event.target.value }))} />
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Input placeholder="Icon URL" value={newAllergen.icon} onChange={(event) => setNewAllergen((prev) => ({ ...prev, icon: event.target.value }))} className="w-32" />
                <Button type="button" size="sm" variant="outline" onClick={() => setIconPickerFor("new")}>
                  Browse
                </Button>
              </div>
            </TableCell>
            <TableCell>
              <Button type="button" size="sm" onClick={handleAdd} disabled={!newAllergen.name.trim()}>
                Add
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <AssetPickerDialog
        open={iconPickerFor !== null}
        onOpenChange={(open) => !open && setIconPickerFor(null)}
        onSelect={(asset) => {
          if (iconPickerFor === "new") {
            setNewAllergen((prev) => ({ ...prev, icon: asset.url }));
          } else if (iconPickerFor) {
            const allergen = (data ?? []).find((a) => a.id === iconPickerFor);
            if (allergen) handleSave(allergen, allergen.name, asset.url);
          }
          setIconPickerFor(null);
        }}
      />
    </div>
  );
}

function AllergenRow({ allergen, onSave, onBrowseIcon }: { allergen: AdminAllergen; onSave: (allergen: AdminAllergen, name: string, icon: string) => void; onBrowseIcon: () => void }) {
  const [name, setName] = useState(allergen.name);
  const [icon, setIcon] = useState(allergen.icon ?? "");
  const dirty = name !== allergen.name || icon !== (allergen.icon ?? "");

  return (
    <TableRow>
      <TableCell>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input value={icon} onChange={(event) => setIcon(event.target.value)} className="w-32" />
          <Button type="button" size="sm" variant="outline" onClick={onBrowseIcon}>
            Browse
          </Button>
        </div>
      </TableCell>
      <TableCell>
        <Button type="button" size="sm" disabled={!dirty} onClick={() => onSave(allergen, name, icon)}>
          Save
        </Button>
      </TableCell>
    </TableRow>
  );
}

function CertificationsPanel() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-certifications"], queryFn: fetchAdminCertifications });
  const [newCertification, setNewCertification] = useState(EMPTY_CERTIFICATION);
  const [error, setError] = useState<string | null>(null);
  const [imagePickerFor, setImagePickerFor] = useState<string | "new" | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-certifications"] });
  }

  async function handleAdd() {
    setError(null);
    try {
      await createAdminCertification({ name: newCertification.name, certificateImage: newCertification.certificateImage || null, documentUrl: newCertification.documentUrl || null });
      setNewCertification(EMPTY_CERTIFICATION);
      toastManager.add({ title: "Certification added" });
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add certification.");
    }
  }

  async function handleSave(certification: AdminCertification, name: string, certificateImage: string, documentUrl: string) {
    setError(null);
    try {
      await updateAdminCertification(certification.id, { name, certificateImage: certificateImage || null, documentUrl: documentUrl || null });
      toastManager.add({ title: "Certification saved" });
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save certification.");
    }
  }

  return (
    <div className="max-w-4xl">
      <h2 className="text-h4 font-heading text-charcoal">Certifications</h2>
      {error && <p className="mt-1 text-small text-destructive">{error}</p>}
      <Table className="mt-2">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Badge image</TableHead>
            <TableHead>Document URL</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data ?? []).map((certification) => (
            <CertificationRow key={certification.id} certification={certification} onSave={handleSave} onBrowseImage={() => setImagePickerFor(certification.id)} />
          ))}
          <TableRow>
            <TableCell>
              <Input placeholder="e.g. ISO 22000" value={newCertification.name} onChange={(event) => setNewCertification((prev) => ({ ...prev, name: event.target.value }))} />
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Input placeholder="Image URL" value={newCertification.certificateImage} onChange={(event) => setNewCertification((prev) => ({ ...prev, certificateImage: event.target.value }))} className="w-32" />
                <Button type="button" size="sm" variant="outline" onClick={() => setImagePickerFor("new")}>
                  Browse
                </Button>
              </div>
            </TableCell>
            <TableCell>
              <Input placeholder="Document URL (optional)" value={newCertification.documentUrl} onChange={(event) => setNewCertification((prev) => ({ ...prev, documentUrl: event.target.value }))} />
            </TableCell>
            <TableCell>
              <Button type="button" size="sm" onClick={handleAdd} disabled={!newCertification.name.trim()}>
                Add
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <AssetPickerDialog
        open={imagePickerFor !== null}
        onOpenChange={(open) => !open && setImagePickerFor(null)}
        onSelect={(asset) => {
          if (imagePickerFor === "new") {
            setNewCertification((prev) => ({ ...prev, certificateImage: asset.url }));
          } else if (imagePickerFor) {
            const certification = (data ?? []).find((c) => c.id === imagePickerFor);
            if (certification) handleSave(certification, certification.name, asset.url, certification.documentUrl ?? "");
          }
          setImagePickerFor(null);
        }}
      />
    </div>
  );
}

function CertificationRow({
  certification,
  onSave,
  onBrowseImage,
}: {
  certification: AdminCertification;
  onSave: (certification: AdminCertification, name: string, certificateImage: string, documentUrl: string) => void;
  onBrowseImage: () => void;
}) {
  const [name, setName] = useState(certification.name);
  const [certificateImage, setCertificateImage] = useState(certification.certificateImage ?? "");
  const [documentUrl, setDocumentUrl] = useState(certification.documentUrl ?? "");
  const dirty = name !== certification.name || certificateImage !== (certification.certificateImage ?? "") || documentUrl !== (certification.documentUrl ?? "");

  return (
    <TableRow>
      <TableCell>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input value={certificateImage} onChange={(event) => setCertificateImage(event.target.value)} className="w-32" />
          <Button type="button" size="sm" variant="outline" onClick={onBrowseImage}>
            Browse
          </Button>
        </div>
      </TableCell>
      <TableCell>
        <Input value={documentUrl} onChange={(event) => setDocumentUrl(event.target.value)} />
      </TableCell>
      <TableCell>
        <Button type="button" size="sm" disabled={!dirty} onClick={() => onSave(certification, name, certificateImage, documentUrl)}>
          Save
        </Button>
      </TableCell>
    </TableRow>
  );
}
