import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Shared "no image" fallback for any product/cart/compare card slot — never
 * pass a missing imageSrc through to next/image (it renders a broken image
 * icon). `size="default"` matches the "No image available" text convention
 * already shipped in export-product-card.tsx/featured-recipe-products.tsx
 * (both left as-is, not migrated to this component) — use it for full
 * responsive card slots (150px+). `size="sm"` is icon-only, for fixed small
 * slots (48-96px) where the text would overflow.
 */
export function ImagePlaceholder({ size = "default", className }: { size?: "default" | "sm"; className?: string }) {
  if (size === "sm") {
    return (
      <div className={cn("flex size-full items-center justify-center text-charcoal/30", className)}>
        <ImageOff className="size-1/3" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={cn("flex size-full items-center justify-center text-small text-charcoal/40", className)}>
      No image available
    </div>
  );
}
