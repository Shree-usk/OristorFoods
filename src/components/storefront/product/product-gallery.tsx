"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { ProductDetailImage, ProductDetailVideo } from "@/services/product.service";

interface GallerySlide {
  type: "image" | "video";
  url: string;
  altText: string;
}

interface ProductGalleryProps {
  images: ProductDetailImage[];
  videos?: ProductDetailVideo[];
  productName: string;
}

export function ProductGallery({ images, videos = [], productName }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const slides: GallerySlide[] = [
    ...images.map((image) => ({ type: "image" as const, url: image.url, altText: image.altText })),
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
