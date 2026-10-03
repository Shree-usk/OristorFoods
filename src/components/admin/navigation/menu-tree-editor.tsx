"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { deleteMenuItem, reorderMenuItems, reparentMenuItem, type MenuItem, type MenuLocationValue } from "@/lib/api/admin-navigation-client";

/**
 * STORY-052. The one genuinely novel piece of UI in this story — every
 * other dnd-kit usage in this codebase (homepage-builder-canvas.tsx,
 * hero-banner-editor.tsx) is a single flat SortableContext. This is the
 * standard dnd-kit "multiple containers" pattern (one DndContext, one
 * SortableContext per container, cross-container drops detected in
 * onDragEnd by comparing the dragged item's current parentId against
 * the drop target's container) — not bespoke, but new to this project.
 */
const MAX_DEPTH_BY_LOCATION: Record<MenuLocationValue, number> = { Header: 2, Footer: 1, Mobile: 0 };

const ROOT_CONTAINER_ID = "root";

function containerIdOf(parentId: string | null): string {
  return parentId ?? ROOT_CONTAINER_ID;
}

function parentIdOf(containerId: string): string | null {
  return containerId === ROOT_CONTAINER_ID ? null : containerId;
}

interface MenuTreeEditorProps {
  location: MenuLocationValue;
  items: MenuItem[];
  onChanged: () => void;
  onAddItem: (parentId: string | null) => void;
  onEditItem: (item: MenuItem) => void;
  /** The Mega Menu tab reuses this same tree editor scoped to one Header item's children (sections + their links/promo tiles) instead of the Header's own top-level list. */
  rootParentId?: string | null;
  rootDepth?: number;
  /** The Header tab's own instance caps this at 0 (top-level items only, no drill-down) — the Mega Menu tab is where depth 1-2 editing happens, in a separate instance scoped via rootParentId/rootDepth above. Defaults to the location's own natural max. */
  maxDepthOverride?: number;
}

export function MenuTreeEditor({ location, items, onChanged, onAddItem, onEditItem, rootParentId = null, rootDepth = 0, maxDepthOverride }: MenuTreeEditorProps) {
  const [error, setError] = useState<string | null>(null);
  const maxDepth = maxDepthOverride ?? MAX_DEPTH_BY_LOCATION[location];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function childrenOf(parentId: string | null): MenuItem[] {
    return items.filter((item) => item.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeItem = items.find((item) => item.id === active.id);
    if (!activeItem) return;

    const overItem = items.find((item) => item.id === over.id);
    const overContainerId = overItem ? containerIdOf(overItem.parentId) : String(over.id);
    const targetParentId = overItem ? overItem.parentId : parentIdOf(overContainerId);
    const sourceParentId = activeItem.parentId;

    setError(null);
    try {
      if (targetParentId === sourceParentId) {
        if (!overItem || active.id === over.id) return;
        const siblings = childrenOf(sourceParentId);
        const oldIndex = siblings.findIndex((item) => item.id === active.id);
        const newIndex = siblings.findIndex((item) => item.id === over.id);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
        const reordered = arrayMove(siblings, oldIndex, newIndex);
        await reorderMenuItems(location, sourceParentId, reordered.map((item) => item.id));
      } else {
        await reparentMenuItem(location, activeItem.id, targetParentId);
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move this item.");
    }
  }

  async function handleDelete(item: MenuItem) {
    setError(null);
    try {
      await deleteMenuItem(location, item.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove this item.");
    }
  }

  return (
    <div>
      {error && <p className="mb-2 text-small text-destructive">{error}</p>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <MenuContainer
          location={location}
          parentId={rootParentId}
          depth={rootDepth}
          maxDepth={maxDepth}
          childrenOf={childrenOf}
          onAddItem={onAddItem}
          onEditItem={onEditItem}
          onDelete={handleDelete}
        />
      </DndContext>
    </div>
  );
}

interface MenuContainerProps {
  location: MenuLocationValue;
  parentId: string | null;
  depth: number;
  maxDepth: number;
  childrenOf: (parentId: string | null) => MenuItem[];
  onAddItem: (parentId: string | null) => void;
  onEditItem: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
}

function MenuContainer({ location, parentId, depth, maxDepth, childrenOf, onAddItem, onEditItem, onDelete }: MenuContainerProps) {
  const items = childrenOf(parentId);
  const containerId = containerIdOf(parentId);
  const { setNodeRef, isOver } = useDroppable({ id: containerId });

  return (
    <div ref={setNodeRef} className={depth === 0 ? "rounded-md border border-border" : "mt-2 rounded-md border border-dashed border-border bg-muted/30 pl-4"}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ul className={isOver ? "divide-y divide-border bg-accent/40" : "divide-y divide-border"}>
          {items.length === 0 && <li className="p-3 text-small text-muted-foreground">{isOver ? "Drop here" : "No items yet."}</li>}
          {items.map((item) => (
            <MenuItemRow key={item.id} item={item} location={location} depth={depth} maxDepth={maxDepth} childrenOf={childrenOf} onAddItem={onAddItem} onEditItem={onEditItem} onDelete={onDelete} />
          ))}
        </ul>
      </SortableContext>
      {/* <=, not < — this container's own items sit AT `depth`, so adding one more here is valid as long as that depth itself is in range (the deepest level, e.g. Header's mega-menu links, must still be addable). Contrast MenuItemRow's "can this item have children" check below, which correctly uses < since a child would sit one level deeper. */}
      {depth <= maxDepth && (
        <Button variant="ghost" size="sm" className="m-2" onClick={() => onAddItem(parentId)}>
          <Plus className="mr-1 size-4" />
          Add item
        </Button>
      )}
    </div>
  );
}

interface MenuItemRowProps {
  item: MenuItem;
  location: MenuLocationValue;
  depth: number;
  maxDepth: number;
  childrenOf: (parentId: string | null) => MenuItem[];
  onAddItem: (parentId: string | null) => void;
  onEditItem: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
}

function MenuItemRow({ item, location, depth, maxDepth, childrenOf, onAddItem, onEditItem, onDelete }: MenuItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const linkSummary = item.linkType === "Internal" ? item.internalPath : item.linkType === "External" ? item.externalUrl : "Grouping only — not clickable";

  return (
    <li ref={setNodeRef} style={style}>
      <div className="flex items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-3">
          <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground active:cursor-grabbing" aria-label={`Reorder ${item.label}`}>
            <GripVertical className="size-4" />
          </button>
          <div>
            <p className="text-small font-medium text-charcoal">
              {item.label}
              {!item.active && <span className="ml-2 text-caption text-muted-foreground">(inactive)</span>}
            </p>
            <p className="text-caption text-muted-foreground">{linkSummary}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onEditItem(item)}>
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(item)}>
            Remove
          </Button>
        </div>
      </div>
      {depth < maxDepth && (
        <MenuContainer location={location} parentId={item.id} depth={depth + 1} maxDepth={maxDepth} childrenOf={childrenOf} onAddItem={onAddItem} onEditItem={onEditItem} onDelete={onDelete} />
      )}
    </li>
  );
}
