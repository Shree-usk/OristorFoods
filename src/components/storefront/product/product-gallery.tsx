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
  // A variant with its own dedicated photos replaces the product's base
  // images entirely while it's selected — falls back to the product's own
  // images for a variant with none set. Videos stay product-level either
  // way (no per-variant video model).
  const variantImages = selectedVariant?.images ?? [];
  const activeImages = variantImages.length > 0 ? variantImages : images;

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

  const slides: GallerySlide[] = [
    ...activeImages.map((image) => ({ type: "image" as const, url: image.url, altText: image.altText ?? productName })),
    ...videos.map((video) => ({ type: "video" as const, url: video.url, altText: video.altText })),
  ];
  const gallery: GallerySlide[] =
    slides.length > 0 ? slides : [{ type: "image", url: "", altText: productName }];
  const active = gallery[activeIndex];

  return (
    <div>
      <Dialog>
        <DialogTrigger
          className="relative block aspect-square w-full overflow-hidden rounded-lg bg-cream"
          aria-label={`Zoom in on ${active.altText}`}
        >
          {active.type === "video" ? (
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
        <DialogContent aria-label={`${productName} media, enlarged`}>
          {active.type === "video" ? (
            <video src={active.url} className="max-h-[80vh] w-full" controls autoPlay />
          ) : (
            <div className="relative aspect-square w-full">
              <Image src={active.url} alt={active.altText} fill sizes="90vw" className="object-contain" />
            </div>
          )}
        </DialogContent>
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
