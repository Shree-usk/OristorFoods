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
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import {
  addExportSolutionCard,
  fetchExportSolutionCards,
  removeExportSolutionCard,
  reorderExportSolutionCards,
  updateExportSolutionCard,
  type ExportSolutionCard,
  type ExportSolutionCardInput,
} from "@/lib/api/admin-export-content-client";
import { EXPORT_ICON_OPTIONS } from "@/lib/export-icons";
import { toastManager } from "@/lib/toast";

const EMPTY_CARD: ExportSolutionCardInput = { icon: "Package", iconImageUrl: "", title: "", description: "", visible: true };

/** /export page revamp. The 3 "Export Solutions" cards shown right after the certification strip — same list+drag-reorder shape as why-choose-features-editor.tsx, minus the section/sheet wrapper since this IS the dedicated admin page. */
export function AdminExportSolutionCardsEditor() {
  const queryClient = useQueryClient();
  const { data: cards = [] } = useQuery({ queryKey: ["admin-export-solution-cards"], queryFn: fetchExportSolutionCards });
  const [editing, setEditing] = useState<ExportSolutionCard | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-export-solution-cards"] });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = cards.findIndex((c) => c.id === active.id);
    const newIndex = cards.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(cards, oldIndex, newIndex);
    try {
      await reorderExportSolutionCards(reordered.map((c) => c.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder cards.");
    } finally {
      invalidate();
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    try {
      await removeExportSolutionCard(id);
      toastManager.add({ title: "Card removed" });
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove card.");
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-h3 font-heading text-charcoal">Export Solutions cards</h2>
        <p className="mt-1 text-small text-charcoal/70">Shown right after the certification strip on the /export page.</p>
      </div>

      {error && <p className="text-small text-destructive">{error}</p>}

      {!editing && (
        <>
          <Button onClick={() => setEditing("new")} size="sm" className="w-fit">
            Add card
          </Button>
          {cards.length === 0 && <p className="text-small text-muted-foreground">No cards yet — nothing shows on the storefront until you add some.</p>}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y divide-border rounded-md border border-border">
                {cards.map((card) => (
                  <SortableCardRow key={card.id} card={card} onEdit={() => setEditing(card)} onRemove={() => handleRemove(card.id)} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </>
      )}

      {editing && (
        <CardForm
          card={editing === "new" ? null : editing}
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

function SortableCardRow({ card, onEdit, onRemove }: { card: ExportSolutionCard; onEdit: () => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const Icon = EXPORT_ICON_OPTIONS[card.icon];

  return (
    <li ref={setNodeRef} style={style} className="flex items-center justify-between gap-3 p-3">
      <div className="flex items-center gap-2 overflow-hidden">
        <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground active:cursor-grabbing" aria-label={`Reorder ${card.title}`}>
          <GripVertical className="size-4" />
        </button>
        {card.iconImageUrl ? (
          <img src={card.iconImageUrl} alt="" className="size-4 shrink-0 object-contain" />
        ) : (
          Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="truncate text-small text-charcoal">{card.title || "(untitled)"}</span>
        {!card.visible && <span className="text-small text-muted-foreground">(hidden)</span>}
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

function CardForm({ card, onSaved, onCancel }: { card: ExportSolutionCard | null; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<ExportSolutionCardInput>(
    card
      ? { icon: card.icon, iconImageUrl: card.iconImageUrl ?? "", title: card.title, description: card.description, visible: card.visible }
      : EMPTY_CARD,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(false);

  function set<K extends keyof ExportSolutionCardInput>(key: K, value: ExportSolutionCardInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (card) await updateExportSolutionCard(card.id, form);
      else await addExportSolutionCard(form);
      toastManager.add({ title: "Card saved" });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save card.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid max-w-xl gap-4">
      <CheckboxOption label="Visible" checked={form.visible ?? true} onCheckedChange={(checked) => set("visible", checked)} />
      <div>
        <Label htmlFor="sol-card-icon">Icon</Label>
        <Select value={form.icon} onValueChange={(value) => value && set("icon", value)}>
          <SelectTrigger id="sol-card-icon">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(EXPORT_ICON_OPTIONS).map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1 text-caption text-charcoal/60">Used unless a custom icon image is uploaded below.</p>
      </div>
      <div>
        <Label>Custom icon image (optional)</Label>
        <div className="mt-1 flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => setPicker(true)}>
            {form.iconImageUrl ? "Change image" : "Upload image"}
          </Button>
          {form.iconImageUrl && (
            <>
              <img src={form.iconImageUrl} alt="" className="size-6 shrink-0 object-contain" />
              <Button type="button" variant="ghost" size="sm" onClick={() => set("iconImageUrl", "")}>
                Clear
              </Button>
            </>
          )}
        </div>
      </div>
      <div>
        <Label htmlFor="sol-card-title">Title</Label>
        <Input id="sol-card-title" value={form.title} onChange={(event) => set("title", event.target.value)} maxLength={100} />
      </div>
      <div>
        <Label htmlFor="sol-card-description">Description</Label>
        <Input id="sol-card-description" value={form.description} onChange={(event) => set("description", event.target.value)} maxLength={300} />
      </div>
      {error && <p className="text-small text-chilli">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {card ? "Save card" : "Add card"}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Back
        </Button>
      </div>

      <AssetPickerDialog
        open={picker}
        onOpenChange={setPicker}
        onSelect={(asset) => {
          set("iconImageUrl", asset.url);
          setPicker(false);
        }}
      />
    </div>
  );
}
