"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  fetchFoodAcademyEntries,
  reorderFoodAcademyFeaturedEntries,
  type FoodAcademyEntryAdminListRow,
} from "@/lib/api/admin-food-academy-client";

/** Drag-reorders the entries currently marked isFeatured — controls their display order on the storefront's "Featured learning content" section. */
export function FoodAcademyFeaturedReorderPanel({ onBack }: { onBack: () => void }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  // Only holds an optimistic in-flight reorder; cleared once the refetch
  // after a successful/failed drag brings the server-derived order back,
  // so the server stays the source of truth and no effect+setState is
  // needed to seed it from the query result.
  const [localOrder, setLocalOrder] = useState<FoodAcademyEntryAdminListRow[] | null>(null);

  const { data } = useQuery({
    queryKey: ["admin-food-academy-entries", { page: 1, pageSize: 100 }],
    queryFn: () => fetchFoodAcademyEntries({ page: 1, pageSize: 100 }),
  });

  const sortedFeatured = useMemo(
    () => (data?.items ?? []).filter((entry) => entry.isFeatured).sort((a, b) => a.sortOrder - b.sortOrder),
    [data],
  );
  const items = localOrder ?? (data ? sortedFeatured : null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    if (!items) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    setLocalOrder(reordered);
    try {
      await reorderFoodAcademyFeaturedEntries(reordered.map((item) => item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder.");
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["admin-food-academy-entries"] });
      setLocalOrder(null);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-h3 font-heading text-charcoal">Reorder featured entries</h2>
          <p className="mt-1 text-small text-charcoal/70">Controls display order in the storefront&apos;s &ldquo;Featured learning content&rdquo; section.</p>
        </div>
        <Button variant="outline" onClick={onBack}>
          Back to entries
        </Button>
      </div>

      {error && <p className="text-small text-destructive">{error}</p>}

      {items && items.length === 0 && <p className="text-small text-muted-foreground">No entries are marked featured yet.</p>}

      {items && items.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-border rounded-md border border-border">
              {items.map((item) => (
                <SortableFeaturedRow key={item.id} item={item} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableFeaturedRow({ item }: { item: FoodAcademyEntryAdminListRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-3 p-3">
      <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground active:cursor-grabbing" aria-label={`Reorder ${item.title}`}>
        <GripVertical className="size-4" />
      </button>
      <span className="truncate text-small text-charcoal">{item.title}</span>
      <span className="text-caption text-muted-foreground">{item.category.name}</span>
    </li>
  );
}
