import type { ProductExportSpecType } from "@/generated/prisma/client";

/**
 * "Packaging & Export Details" spec rows. One human label per
 * ProductExportSpecType, shared between the admin picker (Select needs a
 * label distinct from the stored enum value — Base UI SelectValue shows
 * the raw value without a render prop) and the storefront tiles. Each
 * item's image is an admin-uploaded Media Library image now, not a fixed
 * icon per type — see ProductExportSpecItem.imageUrl.
 */
export const PRODUCT_EXPORT_SPEC_TYPE_LABELS: Record<ProductExportSpecType, string> = {
  PackSizes: "Pack Sizes",
  CartonPacking: "Carton Packing",
  Moq: "MOQ",
  CartonDimensions: "Carton Dimensions",
  GrossCartonWeight: "Gross Carton Weight",
  ShelfLife: "Shelf Life",
  StorageConditions: "Storage Conditions",
  PackagingType: "Packaging Type",
  ExportAvailability: "Export",
  ShippingTerms: "Shipping Terms",
};

export const PRODUCT_EXPORT_SPEC_TYPE_ORDER: ProductExportSpecType[] = [
  "PackSizes",
  "CartonPacking",
  "Moq",
  "CartonDimensions",
  "GrossCartonWeight",
  "ShelfLife",
  "StorageConditions",
  "PackagingType",
  "ExportAvailability",
  "ShippingTerms",
];
