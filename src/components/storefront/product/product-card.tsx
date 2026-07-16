import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ProductListItem } from "@/types/product";

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString()}`;
}

export function ProductCard({ product }: { product: ProductListItem }) {
  return (
    <Link href={product.href} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-cream">
        {product.badge && <Badge className="absolute top-2 left-2 z-10">{product.badge}</Badge>}
        <Image
          src={product.imageSrc}
          alt={product.imageAlt}
          fill
          sizes="(min-width: 1024px) 20vw, (min-width: 640px) 30vw, 45vw"
          className={
            product.inStock
              ? "object-contain p-4 transition-transform duration-300 group-hover:scale-105"
              : "object-contain p-4 opacity-50"
          }
        />
        {!product.inStock && (
          <Badge variant="secondary" className="absolute bottom-2 left-2 z-10">
            Out of stock
          </Badge>
        )}
      </div>
      <p className="mt-3 text-small font-medium text-charcoal">{product.name}</p>
      {product.rating && (
        <div className="mt-1 flex items-center gap-1 text-caption text-charcoal/80">
          <Star className="size-3.5 fill-gold text-gold" aria-hidden="true" />
          <span>{product.rating}</span>
          {product.reviewCount && <span>({product.reviewCount})</span>}
        </div>
      )}
      {product.inStock && (
        <p className="mt-1 font-number text-body text-charcoal">
          {formatPrice(product.price, product.currency)}
        </p>
      )}
    </Link>
  );
}
