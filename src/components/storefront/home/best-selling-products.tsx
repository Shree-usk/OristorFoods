import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";

import { ScrollReveal } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/storefront/layout/section";
import type { ProductCardData } from "@/types/home";

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString()}`;
}

export function BestSellingProducts({ products }: { products: ProductCardData[] }) {
  return (
    <Section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-h2 font-heading text-charcoal">Best Selling Products</h2>
        <Link href="/products?collection=best-sellers" className="text-small text-chilli hover:underline">
          View all
        </Link>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {products.map((product, index) => (
          <ScrollReveal key={product.id} delay={index * 0.05}>
            <Link href={product.href} className="group block">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-cream">
                {product.badge && (
                  <Badge className="absolute top-2 left-2 z-10">{product.badge}</Badge>
                )}
                <Image
                  src={product.imageSrc}
                  alt={product.imageAlt}
                  fill
                  sizes="(min-width: 1024px) 20vw, (min-width: 640px) 30vw, 45vw"
                  className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <p className="mt-3 text-small font-medium text-charcoal">{product.name}</p>
              {product.rating && (
                <div className="mt-1 flex items-center gap-1 text-caption text-charcoal/80">
                  <Star className="size-3.5 fill-gold text-gold" aria-hidden="true" />
                  <span>{product.rating}</span>
                  {product.reviewCount && <span>({product.reviewCount})</span>}
                </div>
              )}
              <p className="mt-1 font-number text-body text-charcoal">
                {formatPrice(product.price, product.currency)}
              </p>
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </Section>
  );
}
