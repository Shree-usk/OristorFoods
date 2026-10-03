"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VersionHistoryPanel } from "@/components/admin/cms/version-history-panel";
import { HeroBannerEditor } from "@/components/admin/homepage-builder/hero-banner-editor";
import { SectionEditor } from "@/components/admin/homepage-builder/section-editor";
import { SECTION_TYPE_LABELS, SECTION_TYPE_ORDER } from "@/components/admin/homepage-builder/section-labels";
import {
  addSection,
  duplicateSection,
  fetchHomepageLayout,
  removeSection,
  reorderSections,
  updateSection,
  type HomepageSection,
  type HomepageSectionType,
} from "@/lib/api/admin-homepage-builder-client";

interface HomepageBuilderCanvasProps {
  layoutId: string;
}

export function HomepageBuilderCanvas({ layoutId }: HomepageBuilderCanvasProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [addType, setAddType] = useState<HomepageSectionType | "">("");

  const { data: layout, isLoading } = useQuery({
    queryKey: ["homepage-builder-layout", layoutId],
    queryFn: () => fetchHomepageLayout(layoutId),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["homepage-builder-layout", layoutId] });
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (!layout) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = layout.sections.findIndex((s) => s.id === active.id);
    const newIndex = layout.sections.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(layout.sections, oldIndex, newIndex);
    queryClient.setQueryData(["homepage-builder-layout", layoutId], { ...layout, sections: reordered });

    try {
      await reorderSections(layoutId, reordered.map((s) => s.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder sections.");
      invalidate();
    }
  }

  async function handleToggleVisible(section: HomepageSection) {
    setError(null);
    try {
      await updateSection(layoutId, section.id, { visible: !section.visible });
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update section.");
    }
  }

  async function handleDuplicate(section: HomepageSection) {
    setError(null);
    try {
      await duplicateSection(layoutId, section.id);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to duplicate section.");
    }
  }

  async function handleRemove(section: HomepageSection) {
    setError(null);
    try {
      await removeSection(layoutId, section.id);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove section.");
    }
  }

  async function handleAddSection() {
    if (!addType) return;
    setError(null);
    try {
      await addSection(layoutId, addType);
      setAddType("");
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add section.");
    }
  }

  if (isLoading) return <p className="text-small text-muted-foreground">Loading…</p>;
  if (!layout) return <p className="text-small text-chilli">Layout not found.</p>;

  const hasHeroBanner = layout.sections.some((s) => s.type === "HeroBanner");
  const editingSection = layout.sections.find((s) => s.id === editingSectionId) ?? null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 font-heading text-charcoal">Edit layout</h1>
          <p className="text-small text-muted-foreground">Status: {layout.status}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href={`/admin/homepage-builder/${layoutId}/preview`} />}>
            Preview
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/admin/homepage-builder" />}>
            Back to layouts
          </Button>
        </div>
      </div>

      {layout.status !== "Draft" && <p className="mt-4 text-small text-chilli">This layout is {layout.status.toLowerCase()} and read-only — start a new draft to make changes.</p>}
      {error && <p className="mt-4 text-small text-chilli">{error}</p>}

      {layout.status === "Draft" && (
        <div className="mt-4 flex items-center gap-2">
          <Select value={addType} onValueChange={(value) => setAddType(value as HomepageSectionType)}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Add a section…" />
            </SelectTrigger>
            <SelectContent>
              {SECTION_TYPE_ORDER.map((type) => (
                <SelectItem key={type} value={type} disabled={type === "HeroBanner" && hasHeroBanner}>
                  {SECTION_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAddSection} disabled={!addType}>
            Add section
          </Button>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={layout.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ul className="mt-6 divide-y divide-border rounded-md border border-border">
            {layout.sections.map((section) => (
              <SortableSectionRow
                key={section.id}
                section={section}
                draftEditable={layout.status === "Draft"}
                onToggleVisible={() => handleToggleVisible(section)}
                onEdit={() => setEditingSectionId(section.id)}
                onDuplicate={() => handleDuplicate(section)}
                onRemove={() => handleRemove(section)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {editingSection && editingSection.type === "HeroBanner" && (
        <HeroBannerEditor
          layoutId={layoutId}
          section={editingSection}
          draftEditable={layout.status === "Draft"}
          open={editingSectionId !== null}
          onOpenChange={(open) => !open && setEditingSectionId(null)}
          onChanged={invalidate}
        />
      )}
      {editingSection && editingSection.type !== "HeroBanner" && (
        <SectionEditor
          layoutId={layoutId}
          section={editingSection}
          draftEditable={layout.status === "Draft"}
          open={editingSectionId !== null}
          onOpenChange={(open) => !open && setEditingSectionId(null)}
          onChanged={invalidate}
        />
      )}

      <div className="mt-6">
        <VersionHistoryPanel entityType="HomepageLayout" entityId={layoutId} onRestored={(restored) => router.push(`/admin/homepage-builder/${restored.id}`)} />
      </div>
    </div>
  );
}

function SortableSectionRow({
  section,
  draftEditable,
  onToggleVisible,
  onEdit,
  onDuplicate,
  onRemove,
}: {
  section: HomepageSection;
  draftEditable: boolean;
  onToggleVisible: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id, disabled: !draftEditable });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <li ref={setNodeRef} style={style} className="flex items-center justify-between gap-4 p-4">
      <div className="flex items-center gap-3">
        {draftEditable && (
          <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground active:cursor-grabbing" aria-label={`Reorder ${SECTION_TYPE_LABELS[section.type]}`}>
            <GripVertical className="size-4" />
          </button>
        )}
        <span className="text-small font-medium text-charcoal">{SECTION_TYPE_LABELS[section.type]}</span>
        {section.type === "HeroBanner" && <span className="text-small text-muted-foreground">{section.banners.length} banner{section.banners.length === 1 ? "" : "s"}</span>}
        {(section.titleOverride || section.descriptionOverride) && <span className="text-small text-muted-foreground">(custom title)</span>}
      </div>
      <div className="flex items-center gap-3">
        <CheckboxOption label="Visible" checked={section.visible} onCheckedChange={onToggleVisible} />
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit
        </Button>
        {section.type !== "HeroBanner" && draftEditable && (
          <Button variant="outline" size="sm" onClick={onDuplicate}>
            Duplicate
          </Button>
        )}
        {draftEditable && (
          <Button variant="destructive" size="sm" onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
    </li>
  );
}
