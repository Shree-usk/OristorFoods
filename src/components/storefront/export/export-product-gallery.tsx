"use client";

import { useState } from "react";
import Image from "next/image";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

export interface ExportProductGalleryImage {
  url: string;
  altText: string | null;
  isPrimary: boolean;
}

interface ExportProductGalleryProps {
  images: ExportProductGalleryImage[];
  productName: string;
}

/**
 * Images-only sibling of product-gallery.tsx's ProductGallery, trimmed of
 * the variant/video machinery this B2B spec-sheet page has no use for —
 * same Dialog-zoom + thumbnail-click activeIndex pattern.
 */
export function ExportProductGallery({ images, productName }: ExportProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? null;

  return (
    <div>
      <Dialog>
        <DialogTrigger
          className="relative block aspect-square w-full overflow-hidden rounded-lg bg-cream"
          aria-label={active ? `Zoom in on ${active.altText ?? productName}` : `${productName}: no image available`}
          disabled={active === null}
        >
          {active === null ? (
            <div className="flex size-full items-center justify-center text-small text-charcoal/40">No image available</div>
          ) : (
            <Image src={active.url} alt={active.altText ?? productName} fill sizes="(min-width: 1024px) 40vw, 90vw" className="object-contain p-6" />
          )}
        </DialogTrigger>
        {active !== null && (
          <DialogContent aria-label={`${productName}, enlarged`}>
            <div className="relative aspect-square w-full">
              <Image src={active.url} alt={active.altText ?? productName} fill sizes="90vw" className="object-contain" />
            </div>
          </DialogContent>
        )}
      </Dialog>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2">
          {images.map((image, index) => (
            <button
              key={image.url + index}
              type="button"
              aria-label={`Show image ${index + 1} of ${images.length}`}
              aria-current={index === activeIndex}
              onClick={() => setActiveIndex(index)}
              className={
                index === activeIndex
                  ? "relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border-2 border-charcoal bg-cream"
                  : "relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-transparent bg-cream"
              }
            >
              <Image src={image.url} alt={image.altText ?? productName} fill sizes="64px" className="object-contain p-1" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
