"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addPerfectMatchProduct,
  deletePerfectMatchProduct,
  fetchPerfectMatchProducts,
  reorderPerfectMatchProducts,
  type PerfectMatchProduct,
} from "@/lib/api/admin-perfect-match-client";
import { fetchAdminProducts } from "@/lib/api/admin-product-client";
import { toastManager } from "@/lib/toast";

/**
 * The admin-selected products for the homepage rail. Adding a product
 * links an EXISTING catalogue Product (search picker, same pattern as
 * FoodAcademyProductPicker) rather than offering a blank "new" form — the
 * overlay fields (kicker, promo description override, default-featured,
 * publish status) and the product's meal pairings are both managed on the
 * product's own detail page (/admin/perfect-match/products/[id]), not
 * inline here. This list is purely add/remove/reorder.
 */
export function AdminPerfectMatchProductsView() {
  const queryClient = useQueryClient();
  const { data: products = [] } = useQuery({ queryKey: ["admin-perfect-match-products"], queryFn: fetchPerfectMatchProducts });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-perfect-match-products"] });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = products.findIndex((p) => p.id === active.id);
    const newIndex = products.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(products, oldIndex, newIndex);
    try {
      await reorderPerfectMatchProducts(reordered.map((p) => p.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder products.");
    } finally {
      invalidate();
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    try {
      await deletePerfectMatchProduct(id);
      toastManager.add({ title: "Product removed" });
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove product.");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-h3 font-heading text-charcoal">Products</h2>
          <p className="mt-1 text-small text-charcoal/70">Up to 5 products shown as selectable tabs on the homepage. Drag to reorder.</p>
        </div>
        <Button size="sm" onClick={() => setPickerOpen(true)}>
          Add product
        </Button>
      </div>

      {error && <p className="text-small text-destructive">{error}</p>}
      {products.length === 0 && <p className="text-small text-muted-foreground">No products yet — nothing shows on the storefront until you add some.</p>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={products.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <ul className="divide-y divide-border rounded-md border border-border">
            {products.map((product) => (
              <SortableProductRow key={product.id} product={product} onRemove={() => handleRemove(product.id)} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {pickerOpen && (
        <ProductPicker
          excludeIds={products.map((p) => p.productId)}
          onClose={() => setPickerOpen(false)}
          onAdded={() => {
            setPickerOpen(false);
            invalidate();
          }}
        />
      )}
    </div>
  );
}

function SortableProductRow({ product, onRemove }: { product: PerfectMatchProduct; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const image = product.product.images[0];

  return (
    <li ref={setNodeRef} style={style} className="flex items-center justify-between gap-3 p-3">
      <div className="flex items-center gap-3 overflow-hidden">
        <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground active:cursor-grabbing" aria-label={`Reorder ${product.product.name}`}>
          <GripVertical className="size-4" />
        </button>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- a small fixed-size admin-list thumbnail, same convention as admin-export-solution-cards-editor.tsx's icon preview.
          <img src={image.url} alt={image.altText ?? ""} className="size-10 shrink-0 rounded object-cover" />
        ) : (
          <div className="size-10 shrink-0 rounded bg-muted" />
        )}
        <div className="min-w-0">
          <p className="truncate text-small font-medium text-charcoal">{product.product.name}</p>
          <p className="flex gap-2 text-caption text-muted-foreground">
            <span>{product.status}</span>
            {product.isDefaultFeatured && <span className="text-chilli">Default featured</span>}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/admin/perfect-match/products/${product.id}`} />}>
          Manage
        </Button>
        <Button variant="destructive" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </li>
  );
}

function ProductPicker({ excludeIds, onClose, onAdded }: { excludeIds: string[]; onClose: () => void; onAdded: () => void }) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["admin-perfect-match-product-search", search],
    queryFn: () => fetchAdminProducts({ page: 1, pageSize: 10, search: search || undefined }),
  });

  async function handleAdd(productId: string) {
    setAdding(productId);
    setError(null);
    try {
      await addPerfectMatchProduct({ productId, kicker: null, promoDescriptionOverride: null, isDefaultFeatured: false });
      toastManager.add({ title: "Product added" });
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add the product.");
    } finally {
      setAdding(null);
    }
  }

  const results = (data?.items ?? []).filter((product) => !excludeIds.includes(product.id));

  return (
    <div className="max-w-md rounded-lg border border-input bg-background p-4 shadow-md">
      <Input placeholder="Search products…" value={search} onChange={(event) => setSearch(event.target.value)} autoFocus />
      {error && <p className="mt-2 text-small text-destructive">{error}</p>}
      <ul className="mt-2 max-h-64 overflow-y-auto">
        {results.map((product) => (
          <li key={product.id}>
            <button
              type="button"
              className="w-full rounded px-2 py-1.5 text-left text-small hover:bg-muted disabled:opacity-50"
              disabled={adding === product.id}
              onClick={() => handleAdd(product.id)}
            >
              {product.name}
            </button>
          </li>
        ))}
        {results.length === 0 && <li className="px-2 py-1.5 text-small text-charcoal/60">No matches.</li>}
      </ul>
      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}
