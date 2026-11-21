import type { LucideIcon } from "lucide-react";
import { Box, Globe2, Layers, Package, Ruler, Snowflake, Tag, Timer, Truck } from "lucide-react";

import type { ProductExportSpecType } from "@/generated/prisma/client";

/**
 * "Packaging & Export Details" spec rows. One label/icon per
 * ProductExportSpecType, shared between the admin picker (Select needs a
 * human label distinct from the stored enum value — Base UI SelectValue
 * shows the raw value without a render prop) and the storefront tiles.
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

export const PRODUCT_EXPORT_SPEC_TYPE_ICONS: Record<ProductExportSpecType, LucideIcon> = {
  PackSizes: Package,
  CartonPacking: Box,
  Moq: Layers,
  CartonDimensions: Ruler,
  GrossCartonWeight: Package,
  ShelfLife: Timer,
  StorageConditions: Snowflake,
  PackagingType: Tag,
  ExportAvailability: Globe2,
  ShippingTerms: Truck,
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
