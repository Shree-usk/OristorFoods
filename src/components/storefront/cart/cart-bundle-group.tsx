import { Button } from "@/components/ui/button";
import type { CartLineItem } from "@/types/cart";

export interface CartLineGroup {
  bundleInstanceId: string | null;
  bundleName: string | null;
  items: CartLineItem[];
}

/**
 * Groups flat cart lines by bundleInstanceId (Story 2) — additive to the
 * existing flat `.map()` rendering, not a replacement: a plain, non-bundle
 * line is still its own singleton group (`bundleInstanceId: null`), so
 * cart-drawer.tsx/cart page.tsx render it exactly as before.
 */
export function groupCartItems(items: CartLineItem[]): CartLineGroup[] {
  const groups: CartLineGroup[] = [];
  const groupByInstanceId = new Map<string, CartLineGroup>();
  for (const item of items) {
    if (!item.bundleInstanceId) {
      groups.push({ bundleInstanceId: null, bundleName: null, items: [item] });
      continue;
    }
    const existing = groupByInstanceId.get(item.bundleInstanceId);
    if (existing) {
      existing.items.push(item);
    } else {
      const group: CartLineGroup = { bundleInstanceId: item.bundleInstanceId, bundleName: item.bundleName, items: [item] };
      groupByInstanceId.set(item.bundleInstanceId, group);
      groups.push(group);
    }
  }
  return groups;
}

export function BundleGroupHeader({ name, onRemove, isRemoving }: { name: string | null; onRemove: () => void; isRemoving?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-dashed border-input pb-2 pt-4">
      <p className="text-small font-medium text-charcoal">{name ?? "Bundle"}</p>
      <Button type="button" variant="ghost" size="sm" disabled={isRemoving} onClick={onRemove}>
        Remove bundle
      </Button>
    </div>
  );
}
