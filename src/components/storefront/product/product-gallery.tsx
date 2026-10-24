"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useVariantSelection } from "@/components/storefront/product/variant-selection-context";
import type { ProductDetailImage, ProductDetailVariant, ProductDetailVideo } from "@/services/product.service";

interface GallerySlide {
  type: "image" | "video";
  url: string;
  altText: string;
}

interface ProductGalleryProps {
  images: ProductDetailImage[];
  videos?: ProductDetailVideo[];
  variants?: ProductDetailVariant[];
  productName: string;
}

export function ProductGallery({ images, videos = [], variants = [], productName }: ProductGalleryProps) {
  const { selectedVariantId } = useVariantSelection();
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) ?? null;
  // A variant's own photo(s) are pinned first, followed by the rest of the
  // product's general gallery (deduped by url) — a variant with none set
  // just shows the product's own images. Previously the variant images
  // replaced the gallery entirely, hiding every other product photo
  // whenever any variant had one set. Videos stay product-level either
  // way (no per-variant video model).
  const variantImages = selectedVariant?.images ?? [];
  const variantImageUrls = new Set(variantImages.map((image) => image.url));
  const activeImages = [...variantImages, ...images.filter((image) => !variantImageUrls.has(image.url))];

  const [activeIndex, setActiveIndex] = useState(0);
  // Reset to the first slide whenever the selected variant changes — adjusting
  // state during render rather than in a useEffect, per this codebase's
  // no-effect/setState-sync discipline (see product-purchase-panel.tsx's own
  // variant-change comment for the same pattern).
  const [lastVariantId, setLastVariantId] = useState(selectedVariantId);
  if (selectedVariantId !== lastVariantId) {
    setLastVariantId(selectedVariantId);
    setActiveIndex(0);
  }

  const gallery: GallerySlide[] = [
    ...activeImages.map((image) => ({ type: "image" as const, url: image.url, altText: image.altText ?? productName })),
    ...videos.map((video) => ({ type: "video" as const, url: video.url, altText: video.altText })),
  ];
  // No images and no video — genuinely nothing to show, not an error state to
  // force through next/image with an empty src (which renders broken).
  const active = gallery[activeIndex] ?? null;

  return (
    <div>
      <Dialog>
        <DialogTrigger
          className="relative block aspect-square w-full overflow-hidden rounded-lg bg-cream"
          aria-label={active ? `Zoom in on ${active.altText}` : `${productName}: no image available`}
          disabled={active === null}
        >
          {active === null ? (
            <div className="flex size-full items-center justify-center text-small text-charcoal/40">No image available</div>
          ) : active.type === "video" ? (
            <video src={active.url} className="size-full object-contain p-6" muted playsInline />
          ) : (
            <Image
              src={active.url}
              alt={active.altText}
              fill
              sizes="(min-width: 1024px) 40vw, 90vw"
              className="object-contain p-6"
            />
          )}
        </DialogTrigger>
        {active !== null && (
          <DialogContent aria-label={`${productName} media, enlarged`}>
            {active.type === "video" ? (
              <video src={active.url} className="max-h-[80vh] w-full" controls autoPlay />
            ) : (
              <div className="relative aspect-square w-full">
                <Image src={active.url} alt={active.altText} fill sizes="90vw" className="object-contain" />
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
      {gallery.length > 1 && (
        <div className="mt-3 flex gap-2">
          {gallery.map((slide, index) => (
            <button
              key={slide.url + index}
              type="button"
              aria-label={`Show ${slide.type === "video" ? "video" : "image"} ${index + 1} of ${gallery.length}`}
              aria-current={index === activeIndex}
              onClick={() => setActiveIndex(index)}
              className={
                index === activeIndex
                  ? "relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border-2 border-charcoal bg-cream"
                  : "relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-transparent bg-cream"
              }
            >
              {slide.type === "video" ? (
                <Play className="size-5 text-charcoal" aria-hidden="true" />
              ) : (
                <Image src={slide.url} alt={slide.altText} fill sizes="64px" className="object-contain p-1" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
