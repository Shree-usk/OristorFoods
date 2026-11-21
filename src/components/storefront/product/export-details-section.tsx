import { Package } from "lucide-react";

import type { ProductDetailExportSpecItem } from "@/services/product.service";
import { PRODUCT_EXPORT_SPEC_TYPE_ICONS, PRODUCT_EXPORT_SPEC_TYPE_LABELS } from "@/lib/product-export-spec-types";

interface ProductExportDetailsSectionProps {
  enabled: boolean;
  heading: string | null;
  items: ProductDetailExportSpecItem[];
}

export function ProductExportDetailsSection({ enabled, heading, items }: ProductExportDetailsSectionProps) {
  if (!enabled || items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gold/30 bg-cream px-6 py-8 sm:px-10">
      <div className="flex items-center gap-2">
        <Package className="size-5 text-chilli" aria-hidden="true" />
        <h2 className="text-h4 font-heading text-chilli">{heading ?? "Packaging & Export Details"}</h2>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {items.map((item) => {
          const Icon = PRODUCT_EXPORT_SPEC_TYPE_ICONS[item.specType];
          return (
            <div key={item.specType} className="flex flex-col items-center text-center">
              <span className="flex size-10 items-center justify-center rounded-full border border-gold/40 bg-gold-light/20 text-chilli">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-2 text-caption font-semibold text-charcoal/80">{PRODUCT_EXPORT_SPEC_TYPE_LABELS[item.specType]}</h3>
              <p className="mt-0.5 text-small font-medium text-charcoal">{item.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
