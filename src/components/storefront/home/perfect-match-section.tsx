"use client";

import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { motion } from "framer-motion";

import { DEFAULT_EASE, useReducedMotion } from "@/components/motion";
import { ImagePlaceholder } from "@/components/storefront/product/image-placeholder";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PerfectMatchProductData } from "@/types/home";

/**
 * Client half of the homepage "Perfect Match" section — the product
 * selector tabs, the two-column featured-product panel, and its up-to-4
 * meal-pairing cards. Receives an already-resolved, non-empty products
 * list from the Server Component (perfect-match.tsx); the empty-state
 * guard lives there, not here.
 *
 * Real WAI-ARIA Tabs pattern (roving tabindex, arrow/Home/End navigation,
 * automatic activation on both click and arrow move) — the approved
 * prototype's own `<nav>` of plain buttons had none of this. Only the
 * active product's panel (and its images) is ever mounted, so switching
 * products never pre-loads every hidden product's photography.
 */
export function PerfectMatchSection({ products }: { products: PerfectMatchProductData[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const prefersReducedMotion = useReducedMotion();

  const activeProduct = products[activeIndex];

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % products.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + products.length) % products.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = products.length - 1;

    if (nextIndex !== null) {
      event.preventDefault();
      setActiveIndex(nextIndex);
      tabRefs.current[nextIndex]?.focus();
    }
  }

  const panelId = `${baseId}-panel-${activeProduct.id}`;

  return (
    <div>
      <div role="tablist" aria-label="Choose a product" className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
        {products.map((product, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={product.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              id={`${baseId}-tab-${product.id}`}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveIndex(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                "shrink-0 rounded-full border px-5 py-2.5 text-small font-semibold tracking-wide uppercase transition-colors",
                isActive
                  ? "border-chilli bg-chilli text-cream shadow-sm"
                  : "border-input bg-background text-charcoal/70 hover:border-chilli hover:text-chilli",
              )}
            >
              {product.tabLabel}
            </button>
          );
        })}
      </div>

      <div id={panelId} role="tabpanel" aria-labelledby={`${baseId}-tab-${activeProduct.id}`}>
        {prefersReducedMotion ? (
          <PerfectMatchPanel product={activeProduct} />
        ) : (
          <motion.div
            key={activeProduct.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: DEFAULT_EASE }}
          >
            <PerfectMatchPanel product={activeProduct} />
          </motion.div>
        )}
      </div>
    </div>
  );
}

function PerfectMatchPanel({ product }: { product: PerfectMatchProductData }) {
  const pairingCount = product.pairings.length;

  return (
    <div>
      <div className="mt-8 grid grid-cols-1 gap-6 rounded-3xl border border-border bg-paper p-4 shadow-[0_18px_48px_-12px_rgba(55,38,25,0.12)] lg:grid-cols-[0.9fr_1.1fr] lg:gap-10 lg:p-8">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-gradient-to-br from-beige via-cream to-beige lg:aspect-auto lg:min-h-[420px]">
          {product.imageSrc ? (
            <Image
              src={product.imageSrc}
              alt={product.imageAlt}
              fill
              sizes="(min-width: 1024px) 45vw, 90vw"
              className="object-contain p-10"
            />
          ) : (
            <ImagePlaceholder />
          )}
        </div>

        <div className="flex flex-col justify-center px-1 py-2 lg:px-4">
          {product.kicker && <p className="text-caption font-semibold tracking-wide text-chilli uppercase">{product.kicker}</p>}
          <h3 className="mt-3 text-h3 font-heading text-charcoal md:text-h2">{product.name}</h3>
          {product.description && <p className="mt-4 max-w-md text-small text-charcoal/75 md:text-body">{product.description}</p>}

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-small text-charcoal/70">
            {pairingCount > 0 && (
              <span>
                <strong className="font-semibold text-chilli">{pairingCount}</strong> delicious pairing{pairingCount === 1 ? "" : "s"}
              </span>
            )}
            <span>Everyday meal inspiration</span>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button nativeButton={false} render={<Link href={product.href} />}>
              Explore this product
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Button>
            <Link href="/products" className="text-small font-semibold text-charcoal underline underline-offset-4 hover:text-chilli">
              Discover all products
            </Link>
          </div>
        </div>
      </div>

      {/* Handles products with no available pairings gracefully — no empty "0 ways" grid. */}
      {pairingCount > 0 && (
        <div className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-caption font-semibold tracking-wide text-chilli uppercase">Made for your table</p>
              <h4 className="mt-2 text-h4 font-heading text-charcoal md:text-h3">{product.name}, four ways</h4>
            </div>
            <p className="text-small text-charcoal/60">Simple pairings. A more memorable meal.</p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {product.pairings.map((pairing, index) => (
              <article
                key={pairing.id}
                className="group overflow-hidden rounded-2xl border border-border bg-paper transition-all duration-300 hover:-translate-y-1 hover:border-stone hover:shadow-[0_18px_48px_-12px_rgba(55,38,25,0.12)]"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-beige">
                  <Image
                    src={pairing.imageSrc}
                    alt={pairing.imageAlt}
                    fill
                    sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 90vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  <p className="text-caption font-semibold tracking-wide text-chilli uppercase">
                    {String(index + 1).padStart(2, "0")}
                    {pairing.categoryLabel ? ` / ${pairing.categoryLabel}` : ""}
                  </p>
                  <h5 className="mt-2 text-body font-heading text-charcoal md:text-h5">{pairing.title}</h5>
                  {pairing.description && <p className="mt-1.5 text-small text-charcoal/70">{pairing.description}</p>}
                  {pairing.supportingTag && (
                    <span className="mt-3 inline-block rounded-full bg-leaf/10 px-3 py-1 text-caption text-leaf-dark">{pairing.supportingTag}</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
