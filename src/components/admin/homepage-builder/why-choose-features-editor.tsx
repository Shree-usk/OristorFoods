"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import {
  addFeature,
  removeFeature,
  reorderFeatures,
  updateFeature,
  type HomepageSection,
  type HomepageSectionFeature,
  type HomepageSectionFeatureInput,
} from "@/lib/api/admin-homepage-builder-client";
import { FEATURE_ICON_OPTIONS } from "@/lib/feature-icons";

interface WhyChooseFeaturesEditorProps {
  layoutId: string;
  section: HomepageSection;
  draftEditable: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

const EMPTY_FEATURE: HomepageSectionFeatureInput = {
  icon: "Leaf",
  title: "",
  description: "",
  visible: true,
};

/**
 * Homepage/Header redesign follow-up. Editor for the WhyChooseOristor
 * section's benefit strip — same list+drawer-form shape as
 * HeroBannerEditor, minus the image picker (an icon Select instead).
 */
export function WhyChooseFeaturesEditor({ layoutId, section, draftEditable, open, onOpenChange, onChanged }: WhyChooseFeaturesEditorProps) {
  const [editingFeature, setEditingFeature] = useState<HomepageSectionFeature | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = section.features.findIndex((f) => f.id === active.id);
    const newIndex = section.features.findIndex((f) => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(section.features, oldIndex, newIndex);
    try {
      await reorderFeatures(layoutId, section.id, reordered.map((f) => f.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder benefit items.");
    } finally {
      onChanged();
    }
  }

  async function handleRemove(featureId: string) {
    setError(null);
    try {
      await removeFeature(layoutId, section.id, featureId);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove benefit item.");
    }
  }

  const currentFeatures = section.features;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{editingFeature ? (editingFeature === "new" ? "Add benefit" : "Edit benefit") : "Why Choose Oristor — benefits strip"}</SheetTitle>
        </SheetHeader>

        {error && <p className="px-4 text-small text-chilli">{error}</p>}

        {!editingFeature && (
          <div className="space-y-4 px-4">
            {draftEditable && currentFeatures.length < 4 && (
              <Button onClick={() => setEditingFeature("new")} size="sm">
                Add benefit
              </Button>
            )}
            {currentFeatures.length === 0 && (
              <p className="text-small text-muted-foreground">
                No benefit items yet — the storefront shows the original 4 approved benefits until you add some here.
              </p>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={currentFeatures.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {currentFeatures.map((feature) => (
                    <SortableFeatureRow
                      key={feature.id}
                      feature={feature}
                      draftEditable={draftEditable}
                      onEdit={() => setEditingFeature(feature)}
                      onRemove={() => handleRemove(feature.id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </div>
        )}

        {editingFeature && (
          <FeatureForm
            layoutId={layoutId}
            sectionId={section.id}
            feature={editingFeature === "new" ? null : editingFeature}
            draftEditable={draftEditable}
            onSaved={() => {
              setEditingFeature(null);
              onChanged();
            }}
            onCancel={() => setEditingFeature(null)}
          />
        )}

        <SheetFooter />
      </SheetContent>
    </Sheet>
  );
}

function SortableFeatureRow({
  feature,
  draftEditable,
  onEdit,
  onRemove,
}: {
  feature: HomepageSectionFeature;
  draftEditable: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: feature.id, disabled: !draftEditable });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const Icon = FEATURE_ICON_OPTIONS[feature.icon];

  return (
    <li ref={setNodeRef} style={style} className="flex items-center justify-between gap-3 p-3">
      <div className="flex items-center gap-2 overflow-hidden">
        {draftEditable && (
          <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground active:cursor-grabbing" aria-label={`Reorder ${feature.title}`}>
            <GripVertical className="size-4" />
          </button>
        )}
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
        <span className="truncate text-small text-charcoal">{feature.title || "(untitled)"}</span>
        {!feature.visible && <span className="text-small text-muted-foreground">(hidden)</span>}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit
        </Button>
        {draftEditable && (
          <Button variant="destructive" size="sm" onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
    </li>
  );
}

function FeatureForm({
  layoutId,
  sectionId,
  feature,
  draftEditable,
  onSaved,
  onCancel,
}: {
  layoutId: string;
  sectionId: string;
  feature: HomepageSectionFeature | null;
  draftEditable: boolean;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<HomepageSectionFeatureInput>(
    feature
      ? { icon: feature.icon, title: feature.title, description: feature.description, visible: feature.visible }
      : EMPTY_FEATURE,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof HomepageSectionFeatureInput>(key: K, value: HomepageSectionFeatureInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (feature) await updateFeature(layoutId, sectionId, feature.id, form);
      else await addFeature(layoutId, sectionId, form);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save benefit item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 overflow-y-auto px-4">
      <CheckboxOption label="Visible" checked={form.visible ?? true} onCheckedChange={(checked) => set("visible", checked)} />

      <div>
        <Label htmlFor="feature-icon">Icon</Label>
        <Select value={form.icon} onValueChange={(value) => value && set("icon", value)}>
          <SelectTrigger id="feature-icon" disabled={!draftEditable}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(FEATURE_ICON_OPTIONS).map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="feature-title">Title</Label>
        <Input id="feature-title" value={form.title} onChange={(event) => set("title", event.target.value)} disabled={!draftEditable} maxLength={100} />
      </div>

      <div>
        <Label htmlFor="feature-description">Description</Label>
        <Input id="feature-description" value={form.description} onChange={(event) => set("description", event.target.value)} disabled={!draftEditable} maxLength={300} />
      </div>

      {error && <p className="text-small text-chilli">{error}</p>}

      <div className="flex gap-2 pb-4">
        {draftEditable && (
          <Button onClick={handleSave} disabled={saving}>
            {feature ? "Save benefit" : "Add benefit"}
          </Button>
        )}
        <Button variant="outline" onClick={onCancel}>
          Back
        </Button>
      </div>
    </div>
  );
}
