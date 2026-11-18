"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AssetPickerDialog } from "@/components/admin/media/asset-picker-dialog";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createFoodAcademyCategory,
  deleteFoodAcademyCategory,
  fetchFoodAcademyCategories,
  reorderFoodAcademyCategories,
  updateFoodAcademyCategory,
  type FoodAcademyCategory,
  type FoodAcademyCategoryInput,
} from "@/lib/api/admin-food-academy-client";
import { toastManager } from "@/lib/toast";

const EMPTY_CATEGORY: FoodAcademyCategoryInput = { name: "", slug: "", description: "", tileImageUrl: "", tileImageAlt: "", status: "Active" };

/**
 * Learning categories shown as the "Explore the world of flavour" subject
 * tiles on /food-academy, and reused as the hub page's existing category
 * filter chips — same list+drag-reorder+inline-form shape as
 * admin-export-solution-cards-editor.tsx.
 */
export function AdminFoodAcademyCategoriesView() {
  const queryClient = useQueryClient();
  const { data: categories = [] } = useQuery({ queryKey: ["admin-food-academy-categories"], queryFn: fetchFoodAcademyCategories });
  const [editing, setEditing] = useState<FoodAcademyCategory | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-food-academy-categories"] });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(categories, oldIndex, newIndex);
    try {
      await reorderFoodAcademyCategories(reordered.map((c) => c.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder categories.");
    } finally {
      invalidate();
    }
  }

  async function handleRemove(category: FoodAcademyCategory) {
    setError(null);
    try {
      await deleteFoodAcademyCategory(category.id);
      toastManager.add({ title: "Category removed" });
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove category.");
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-h3 font-heading text-charcoal">Learning categories</h2>
        <p className="mt-1 text-small text-charcoal/70">
          Shown as subject tiles on /food-academy and used to filter the entry listing. Reorder to control tile order.
        </p>
      </div>

      {error && <p className="text-small text-destructive">{error}</p>}

      {!editing && (
        <>
          <Button onClick={() => setEditing("new")} size="sm" className="w-fit">
            Add category
          </Button>
          {categories.length === 0 && <p className="text-small text-muted-foreground">No categories yet.</p>}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y divide-border rounded-md border border-border">
                {categories.map((category) => (
                  <SortableCategoryRow key={category.id} category={category} onEdit={() => setEditing(category)} onRemove={() => handleRemove(category)} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </>
      )}

      {editing && (
        <CategoryForm
          category={editing === "new" ? null : editing}
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

function SortableCategoryRow({ category, onEdit, onRemove }: { category: FoodAcademyCategory; onEdit: () => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <li ref={setNodeRef} style={style} className="flex items-center justify-between gap-3 p-3">
      <div className="flex items-center gap-2 overflow-hidden">
        <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground active:cursor-grabbing" aria-label={`Reorder ${category.name}`}>
          <GripVertical className="size-4" />
        </button>
        {category.tileImageUrl && <img src={category.tileImageUrl} alt="" className="size-6 shrink-0 rounded object-cover" />}
        <span className="truncate text-small text-charcoal">{category.name}</span>
        <span className="shrink-0 text-caption text-muted-foreground">
          {category._count.entries} {category._count.entries === 1 ? "entry" : "entries"}
        </span>
        {category.status === "Inactive" && <span className="shrink-0 text-small text-muted-foreground">(inactive)</span>}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="destructive" size="sm" onClick={onRemove} disabled={category._count.entries > 0} title={category._count.entries > 0 ? "Reassign or delete its entries first" : undefined}>
          Remove
        </Button>
      </div>
    </li>
  );
}

function CategoryForm({ category, onSaved, onCancel }: { category: FoodAcademyCategory | null; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<FoodAcademyCategoryInput>(
    category
      ? {
          name: category.name,
          slug: category.slug,
          description: category.description ?? "",
          tileImageUrl: category.tileImageUrl ?? "",
          tileImageAlt: category.tileImageAlt ?? "",
          status: category.status,
        }
      : EMPTY_CATEGORY,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(false);

  function set<K extends keyof FoodAcademyCategoryInput>(key: K, value: FoodAcademyCategoryInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (category) await updateFoodAcademyCategory(category.id, form);
      else await createFoodAcademyCategory(form);
      toastManager.add({ title: "Category saved" });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save category.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid max-w-xl gap-4">
      <CheckboxOption label="Active" checked={form.status === "Active"} onCheckedChange={(checked) => set("status", checked ? "Active" : "Inactive")} />
      <div>
        <Label htmlFor="fa-cat-name">Name</Label>
        <Input id="fa-cat-name" value={form.name} onChange={(event) => set("name", event.target.value)} maxLength={100} />
      </div>
      <div>
        <Label htmlFor="fa-cat-slug">Slug</Label>
        <Input id="fa-cat-slug" value={form.slug} onChange={(event) => set("slug", event.target.value)} maxLength={100} />
        <p className="mt-1 text-caption text-charcoal/60">Lowercase letters, numbers and hyphens only — used in the hub page&apos;s filter URL.</p>
      </div>
      <div>
        <Label htmlFor="fa-cat-description">Description</Label>
        <Textarea id="fa-cat-description" value={form.description ?? ""} onChange={(event) => set("description", event.target.value)} maxLength={500} />
      </div>
      <div>
        <Label>Tile image</Label>
        <div className="mt-1 flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => setPicker(true)}>
            {form.tileImageUrl ? "Change image" : "Upload image"}
          </Button>
          {form.tileImageUrl && (
            <>
              <img src={form.tileImageUrl} alt="" className="size-10 shrink-0 rounded object-cover" />
              <Button type="button" variant="ghost" size="sm" onClick={() => set("tileImageUrl", "")}>
                Clear
              </Button>
            </>
          )}
        </div>
      </div>
      {error && <p className="text-small text-chilli">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {category ? "Save category" : "Add category"}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Back
        </Button>
      </div>

      <AssetPickerDialog
        open={picker}
        onOpenChange={setPicker}
        onSelect={(asset) => {
          set("tileImageUrl", asset.url);
          if (asset.altText) set("tileImageAlt", asset.altText);
          setPicker(false);
        }}
      />
    </div>
  );
}
