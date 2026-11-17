"use client";

import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { useExportCatalogueSelectionStore, type SelectedExportProduct } from "@/lib/stores/export-catalogue-selection-store";

/** Shared by the catalogue card and the product detail page so both toggle the same selection store with one implementation. */
export function ExportProductSelectionAction({ product }: { product: SelectedExportProduct }) {
  const isSelected = useExportCatalogueSelectionStore((state) => state.has(product.id));
  const toggle = useExportCatalogueSelectionStore((state) => state.toggle);

  return <CheckboxOption label={isSelected ? "Selected" : "Add to selection"} checked={isSelected} onCheckedChange={() => toggle(product)} />;
}
