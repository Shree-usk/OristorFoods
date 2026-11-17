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
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import {
  addExportCertificationStripItem,
  fetchExportCertificationStripItems,
  removeExportCertificationStripItem,
  reorderExportCertificationStripItems,
  updateExportCertificationStripItem,
  type ExportCertificationStripItem,
  type ExportCertificationStripItemInput,
} from "@/lib/api/admin-export-content-client";
import { toastManager } from "@/lib/toast";

const EMPTY_ITEM: ExportCertificationStripItemInput = { imageUrl: "", label: "", visible: true };

/**
 * /export page revamp. The strip shown right under the hero — its own
 * admin-managed content, deliberately NOT drawn from the Certifications
 * master list, so the business can add any short trust claim here without
 * it becoming a real product certification. Same list+drag-reorder shape
 * as admin-export-solution-cards-editor.tsx.
 */
export function AdminExportCertificationStripEditor() {
  const queryClient = useQueryClient();
  const { data: items = [] } = useQuery({ queryKey: ["admin-export-certification-strip"], queryFn: fetchExportCertificationStripItems });
  const [editing, setEditing] = useState<ExportCertificationStripItem | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-export-certification-strip"] });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    try {
      await reorderExportCertificationStripItems(reordered.map((item) => item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder items.");
    } finally {
      invalidate();
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    try {
      await removeExportCertificationStripItem(id);
      toastManager.add({ title: "Item removed" });
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove item.");
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-h3 font-heading text-charcoal">Certification strip</h2>
        <p className="mt-1 text-small text-charcoal/70">The dark strip shown right under the hero. Add as many badges/claims as you like.</p>
      </div>

      {error && <p className="text-small text-destructive">{error}</p>}

      {!editing && (
        <>
          <Button onClick={() => setEditing("new")} size="sm" className="w-fit">
            Add item
          </Button>
          {items.length === 0 && <p className="text-small text-muted-foreground">No items yet — nothing shows on the storefront until you add some.</p>}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y divide-border rounded-md border border-border">
                {items.map((item) => (
                  <SortableItemRow key={item.id} item={item} onEdit={() => setEditing(item)} onRemove={() => handleRemove(item.id)} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </>
      )}

      {editing && (
        <ItemForm
          item={editing === "new" ? null : editing}
          onSaved={() => {
            setEditing(null);
            invalidate();
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function SortableItemRow({ item, onEdit, onRemove }: { item: ExportCertificationStripItem; onEdit: () => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <li ref={setNodeRef} style={style} className="flex items-center justify-between gap-3 p-3">
      <div className="flex items-center gap-2 overflow-hidden">
        <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground active:cursor-grabbing" aria-label={`Reorder ${item.label}`}>
          <GripVertical className="size-4" />
        </button>
        {item.imageUrl && <img src={item.imageUrl} alt="" className="size-4 shrink-0 object-contain" />}
        <span className="truncate text-small text-charcoal">{item.label || "(untitled)"}</span>
        {!item.visible && <span className="text-small text-muted-foreground">(hidden)</span>}
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

function ItemForm({ item, onSaved, onCancel }: { item: ExportCertificationStripItem | null; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<ExportCertificationStripItemInput>(
    item ? { imageUrl: item.imageUrl ?? "", label: item.label, visible: item.visible } : EMPTY_ITEM,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(false);

  function set<K extends keyof ExportCertificationStripItemInput>(key: K, value: ExportCertificationStripItemInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (item) await updateExportCertificationStripItem(item.id, form);
      else await addExportCertificationStripItem(form);
      toastManager.add({ title: "Item saved" });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid max-w-xl gap-4">
      <CheckboxOption label="Visible" checked={form.visible ?? true} onCheckedChange={(checked) => set("visible", checked)} />
      <div>
        <Label>Image (optional)</Label>
        <div className="mt-1 flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => setPicker(true)}>
            {form.imageUrl ? "Change image" : "Choose image"}
          </Button>
          {form.imageUrl && (
            <>
              <img src={form.imageUrl} alt="" className="size-5 shrink-0 object-contain" />
              <Button type="button" variant="ghost" size="sm" onClick={() => set("imageUrl", "")}>
                Clear
              </Button>
            </>
          )}
        </div>
      </div>
      <div>
        <Label htmlFor="strip-item-label">Label</Label>
        <Input id="strip-item-label" value={form.label} onChange={(event) => set("label", event.target.value)} maxLength={100} />
      </div>
      {error && <p className="text-small text-chilli">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {item ? "Save item" : "Add item"}
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
          setPicker(false);
        }}
      />
    </div>
  );
}
