"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import {
  addExportProcessStep,
  fetchExportProcessSteps,
  removeExportProcessStep,
  reorderExportProcessSteps,
  updateExportProcessStep,
  type ExportProcessStep,
  type ExportProcessStepInput,
} from "@/lib/api/admin-export-content-client";
import { EXPORT_ICON_OPTIONS } from "@/lib/export-icons";
import { toastManager } from "@/lib/toast";

const EMPTY_STEP: ExportProcessStepInput = { icon: "FileText", title: "", description: "", visible: true };

/** /export page revamp. "Our Export Process" timeline steps — same shape as admin-export-solution-cards-editor.tsx. */
export function AdminExportProcessStepsEditor() {
  const queryClient = useQueryClient();
  const { data: steps = [] } = useQuery({ queryKey: ["admin-export-process-steps"], queryFn: fetchExportProcessSteps });
  const [editing, setEditing] = useState<ExportProcessStep | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-export-process-steps"] });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(steps, oldIndex, newIndex);
    try {
      await reorderExportProcessSteps(reordered.map((s) => s.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder steps.");
    } finally {
      invalidate();
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    try {
      await removeExportProcessStep(id);
      toastManager.add({ title: "Step removed" });
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove step.");
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-h3 font-heading text-charcoal">Export Process steps</h2>
        <p className="mt-1 text-small text-charcoal/70">The &quot;Our Export Process&quot; timeline, shown below the Export Solutions cards.</p>
      </div>

      {error && <p className="text-small text-destructive">{error}</p>}

      {!editing && (
        <>
          <Button onClick={() => setEditing("new")} size="sm" className="w-fit">
            Add step
          </Button>
          {steps.length === 0 && <p className="text-small text-muted-foreground">No steps yet — nothing shows on the storefront until you add some.</p>}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y divide-border rounded-md border border-border">
                {steps.map((step, index) => (
                  <SortableStepRow key={step.id} step={step} index={index} onEdit={() => setEditing(step)} onRemove={() => handleRemove(step.id)} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </>
      )}

      {editing && (
        <StepForm
          step={editing === "new" ? null : editing}
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

function SortableStepRow({ step, index, onEdit, onRemove }: { step: ExportProcessStep; index: number; onEdit: () => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const Icon = EXPORT_ICON_OPTIONS[step.icon];

  return (
    <li ref={setNodeRef} style={style} className="flex items-center justify-between gap-3 p-3">
      <div className="flex items-center gap-2 overflow-hidden">
        <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground active:cursor-grabbing" aria-label={`Reorder ${step.title}`}>
          <GripVertical className="size-4" />
        </button>
        <span className="text-caption font-medium text-chilli">{index + 1}.</span>
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
        <span className="truncate text-small text-charcoal">{step.title || "(untitled)"}</span>
        {!step.visible && <span className="text-small text-muted-foreground">(hidden)</span>}
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

function StepForm({ step, onSaved, onCancel }: { step: ExportProcessStep | null; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<ExportProcessStepInput>(
    step ? { icon: step.icon, title: step.title, description: step.description, visible: step.visible } : EMPTY_STEP,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof ExportProcessStepInput>(key: K, value: ExportProcessStepInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (step) await updateExportProcessStep(step.id, form);
      else await addExportProcessStep(form);
      toastManager.add({ title: "Step saved" });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save step.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid max-w-xl gap-4">
      <CheckboxOption label="Visible" checked={form.visible ?? true} onCheckedChange={(checked) => set("visible", checked)} />
      <div>
        <Label htmlFor="proc-step-icon">Icon</Label>
        <Select value={form.icon} onValueChange={(value) => value && set("icon", value)}>
          <SelectTrigger id="proc-step-icon">
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
      </div>
      <div>
        <Label htmlFor="proc-step-title">Title</Label>
        <Input id="proc-step-title" value={form.title} onChange={(event) => set("title", event.target.value)} maxLength={100} />
      </div>
      <div>
        <Label htmlFor="proc-step-description">Description</Label>
        <Input id="proc-step-description" value={form.description} onChange={(event) => set("description", event.target.value)} maxLength={300} />
      </div>
      {error && <p className="text-small text-chilli">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {step ? "Save step" : "Add step"}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Back
        </Button>
      </div>
    </div>
  );
}
