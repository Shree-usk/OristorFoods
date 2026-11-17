"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import type { ExportCatalogueProduct } from "@/lib/api/export-catalogue-client";

import { ExportProductSelectionAction } from "./export-product-selection-action";

function formatPackSize(weightGrams: number | null): string | null {
  if (!weightGrams) return null;
  return weightGrams >= 1000 ? `${(weightGrams / 1000).toFixed(weightGrams % 1000 === 0 ? 0 : 1)}kg` : `${weightGrams}g`;
}

/**
 * `object-contain`, never `object-cover` — the spec's critical image
 * requirement is that a product's packaging/label is never cropped, with
 * the product occupying 75–90% of the image area. Cropping is a server-side
 * authoring concern (how the admin-selected Media Library asset was
 * originally framed); this card never crops what it's given.
 */
export function ExportProductCard({ product }: { product: ExportCatalogueProduct }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const image = product.images[activeIndex] ?? product.images[0] ?? null;
  const description = product.exportDescription ?? product.shortDescription;
  const packSize = formatPackSize(product.weightGrams);
  const detailHref = `/export/catalogue/${product.slug}`;

  return (
    <div className="flex flex-col rounded-lg border border-charcoal/10 bg-ivory p-4">
      <Link href={detailHref} className="group block">
        <div className="relative aspect-square overflow-hidden rounded-md bg-white">
          {image ? (
            <Image src={image.url} alt={image.altText ?? product.name} fill sizes="(min-width: 1024px) 25vw, 45vw" className="object-contain p-4" />
          ) : (
            <div className="flex size-full items-center justify-center text-small text-charcoal/40">No image available</div>
          )}
          {product.isExportFeatured ? (
            <span className="absolute left-2 top-2 rounded-full bg-chilli px-2 py-0.5 text-xs font-medium text-ivory">Featured</span>
          ) : null}
          {product.images.length > 1 ? (
            <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5">
              {product.images.map((img, index) => (
                <button
                  key={img.url}
                  type="button"
                  aria-label={`Show image ${index + 1} of ${product.images.length}`}
                  aria-current={index === activeIndex}
                  className={`size-1.5 rounded-full transition-colors ${index === activeIndex ? "bg-charcoal" : "bg-charcoal/30"}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setActiveIndex(index);
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-1 flex-col gap-1">
          <p className="text-body font-heading text-charcoal group-hover:underline">{product.name}</p>
          <p className="text-xs text-charcoal/60">
            SKU {product.sku}
            {packSize ? ` · ${packSize}` : ""}
          </p>
          {product.collections.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {product.collections.map((collection) => (
                <span key={collection.id} className="rounded-full bg-charcoal/5 px-2 py-0.5 text-xs text-charcoal/70">
                  {collection.name}
                </span>
              ))}
            </div>
          ) : null}
          {description ? <p className="mt-1 line-clamp-3 text-small text-charcoal/70">{description}</p> : null}
        </div>
      </Link>

      <div className="mt-3 border-t border-charcoal/10 pt-3">
        <ExportProductSelectionAction product={{ id: product.id, name: product.name, sku: product.sku }} />
      </div>
    </div>
  );
}
