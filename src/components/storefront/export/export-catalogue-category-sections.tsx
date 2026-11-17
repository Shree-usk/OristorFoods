import Link from "next/link";

import { EXPORT_CATALOGUE_UNCATEGORIZED_SLUG } from "@/lib/export-catalogue-constants";
import type { ExportCatalogueCategoryGroup } from "@/services/export-catalogue.service";

import { ExportProductCard } from "./export-product-card";

/** Default view of the export catalogue — one section per category, collapsing to the flat filtered grid once search/collection/category is active (see export-product-catalogue.tsx). */
export function ExportCatalogueCategorySections({ groups }: { groups: ExportCatalogueCategoryGroup[] }) {
  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-10">
      {groups.map((group) => {
        const name = group.category?.name ?? "Uncategorized";
        const slug = group.category?.slug ?? EXPORT_CATALOGUE_UNCATEGORIZED_SLUG;

        return (
          <div key={group.category?.id ?? "uncategorized"}>
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-h3 font-heading text-charcoal">{name}</h3>
              {group.total > group.items.length ? (
                <Link href={`/export?category=${slug}#catalogue`} scroll={false} className="shrink-0 text-small text-chilli hover:underline">
                  View all in {name}
                </Link>
              ) : null}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {group.items.map((product) => (
                <ExportProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
