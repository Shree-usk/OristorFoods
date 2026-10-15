"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import type { ProductDetailVariant } from "@/services/product.service";

interface VariantSelectionContextValue {
  selectedVariantId: string | null;
  setSelectedVariantId: (variantId: string | null) => void;
}

const VariantSelectionContext = createContext<VariantSelectionContextValue | null>(null);

function defaultVariantId(variants: ProductDetailVariant[]): string | null {
  const firstAvailable = variants.find((variant) => variant.inStock && variant.stockQuantity > 0);
  return (firstAvailable ?? variants[0])?.id ?? null;
}

/**
 * Shared selected-variant state for the PDP's gallery and purchase panel —
 * they're siblings in page.tsx (title/rating sit between them), not
 * parent/child, so prop drilling can't connect them without restructuring
 * the two-column layout. Both read `selectedVariantId` from here instead;
 * ProductPurchasePanel also writes to it when the shopper picks a size.
 */
export function VariantSelectionProvider({ variants, children }: { variants: ProductDetailVariant[]; children: ReactNode }) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(() => defaultVariantId(variants));
  return <VariantSelectionContext.Provider value={{ selectedVariantId, setSelectedVariantId }}>{children}</VariantSelectionContext.Provider>;
}

export function useVariantSelection(): VariantSelectionContextValue {
  const context = useContext(VariantSelectionContext);
  if (!context) throw new Error("useVariantSelection must be used within a VariantSelectionProvider");
  return context;
}
