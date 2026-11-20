"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AssetPickerDialog } from "@/components/admin/media/asset-picker-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  addPerfectMatchPairing,
  deletePerfectMatchPairing,
  fetchPerfectMatchPairings,
  reorderPerfectMatchPairings,
  updatePerfectMatchPairing,
  type PerfectMatchPairing,
  type PerfectMatchPairingInput,
} from "@/lib/api/admin-perfect-match-client";
import { toastManager } from "@/lib/toast";

const EMPTY_PAIRING: PerfectMatchPairingInput = { title: "", description: "", imageUrl: "", imageAlt: "", categoryLabel: "", supportingTag: "", status: "Draft" };
const MAX_PAIRINGS = 4;

/** A product's up to 4 meal-pairing cards — list+drag-reorder+inline add/edit form, same shape as admin-export-solution-cards-editor.tsx. */
export function PerfectMatchPairingsReorderPanel({ productLinkId }: { productLinkId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["admin-perfect-match-pairings", productLinkId];
  const { data: pairings = [] } = useQuery({ queryKey, queryFn: () => fetchPerfectMatchPairings(productLinkId) });
  const [editing, setEditing] = useState<PerfectMatchPairing | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const publishedCount = pairings.filter((p) => p.status === "Published").length;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = pairings.findIndex((p) => p.id === active.id);
    const newIndex = pairings.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(pairings, oldIndex, newIndex);
    try {
      await reorderPerfectMatchPairings(productLinkId, reordered.map((p) => p.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder pairings.");
    } finally {
      invalidate();
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    try {
      await deletePerfectMatchPairing(id);
      toastManager.add({ title: "Pairing removed" });
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove pairing.");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-h4 font-heading text-charcoal">Meal pairings</h2>
          <p className="mt-1 text-small text-charcoal/70">
            {publishedCount} / {MAX_PAIRINGS} published — the homepage shows up to {MAX_PAIRINGS} published pairings for this product.
          </p>
        </div>
        {!editing && pairings.length < MAX_PAIRINGS && (
          <Button size="sm" onClick={() => setEditing("new")}>
            Add pairing
          </Button>
        )}
      </div>

      {error && <p className="text-small text-destructive">{error}</p>}
      {pairings.length === 0 && <p className="text-small text-muted-foreground">No pairings yet.</p>}

      {!editing && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={pairings.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-border rounded-md border border-border">
              {pairings.map((pairing, index) => (
                <SortablePairingRow key={pairing.id} pairing={pairing} index={index} onEdit={() => setEditing(pairing)} onRemove={() => handleRemove(pairing.id)} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {editing && (
        <PairingForm
          pairing={editing === "new" ? null : editing}
          onSaved={() => {
            setEditing(null);
            invalidate();
          }}
          onCancel={() => setEditing(null)}
          productLinkId={productLinkId}
        />
      )}
    </div>
  );
}

function SortablePairingRow({ pairing, index, onEdit, onRemove }: { pairing: PerfectMatchPairing; index: number; onEdit: () => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pairing.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <li ref={setNodeRef} style={style} className="flex items-center justify-between gap-3 p-3">
      <div className="flex items-center gap-3 overflow-hidden">
        <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground active:cursor-grabbing" aria-label={`Reorder ${pairing.title}`}>
          <GripVertical className="size-4" />
        </button>
        {pairing.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- small fixed-size admin-list thumbnail.
          <img src={pairing.imageUrl} alt={pairing.imageAlt ?? ""} className="size-10 shrink-0 rounded object-cover" />
        ) : (
          <div className="size-10 shrink-0 rounded bg-muted" />
        )}
        <div className="min-w-0">
          <p className="truncate text-small font-medium text-charcoal">
            {String(index + 1).padStart(2, "0")} — {pairing.title || "(untitled)"}
          </p>
          <p className="text-caption text-muted-foreground">{pairing.status}</p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="destructive" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </li>
  );
}

function PairingForm({
  pairing,
  productLinkId,
  onSaved,
  onCancel,
}: {
  pairing: PerfectMatchPairing | null;
  productLinkId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<PerfectMatchPairingInput>(
    pairing
      ? {
          title: pairing.title,
          description: pairing.description ?? "",
          imageUrl: pairing.imageUrl,
          imageAlt: pairing.imageAlt ?? "",
          categoryLabel: pairing.categoryLabel ?? "",
          supportingTag: pairing.supportingTag ?? "",
          status: pairing.status,
        }
      : EMPTY_PAIRING,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(false);

  function set<K extends keyof PerfectMatchPairingInput>(key: K, value: PerfectMatchPairingInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (pairing) await updatePerfectMatchPairing(pairing.id, form);
      else await addPerfectMatchPairing(productLinkId, form);
      toastManager.add({ title: "Pairing saved" });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the pairing.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid max-w-xl gap-4">
      <div>
        <Label htmlFor="pm-pairing-title">Title</Label>
        <Input id="pm-pairing-title" value={form.title} onChange={(event) => set("title", event.target.value)} placeholder="Sri Lankan Rotti" maxLength={150} />
      </div>
      <div>
        <Label htmlFor="pm-pairing-description">Description</Label>
        <Textarea
          id="pm-pairing-description"
          value={form.description ?? ""}
          onChange={(event) => set("description", event.target.value)}
          placeholder="Soft, warm rotti meets the bold character of garlic curry."
          maxLength={300}
        />
      </div>
      <div>
        <Label>Photograph</Label>
        <div className="mt-1 flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => setPicker(true)}>
            {form.imageUrl ? "Change image" : "Upload image"}
          </Button>
          {form.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- small fixed-size admin-form preview.
            <img src={form.imageUrl} alt="" className="size-10 shrink-0 rounded object-cover" />
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="pm-pairing-category-label">Category label</Label>
          <Input id="pm-pairing-category-label" value={form.categoryLabel ?? ""} onChange={(event) => set("categoryLabel", event.target.value)} placeholder="THE CLASSIC" maxLength={60} />
        </div>
        <div>
          <Label htmlFor="pm-pairing-supporting-tag">Supporting tag</Label>
          <Input id="pm-pairing-supporting-tag" value={form.supportingTag ?? ""} onChange={(event) => set("supportingTag", event.target.value)} placeholder="A comforting favourite" maxLength={80} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="pm-pairing-status">Status</Label>
        <Select value={form.status} onValueChange={(value) => value && set("status", value as PerfectMatchPairingInput["status"])}>
          <SelectTrigger id="pm-pairing-status" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Published">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-small text-chilli">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {pairing ? "Save pairing" : "Add pairing"}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Back
        </Button>
      </div>

      <AssetPickerDialog
        open={picker}
        onOpenChange={setPicker}
        onSelect={(asset) => {
          set("imageUrl", asset.url);
          if (asset.altText) set("imageAlt", asset.altText);
          setPicker(false);
        }}
      />
    </div>
  );
}
