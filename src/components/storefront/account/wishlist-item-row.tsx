"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAddToCart } from "@/hooks/use-add-to-cart";
import type { ProductListItem } from "@/types/product";

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString()}`;
}

export function WishlistItemRow({ item, onRemove }: { item: ProductListItem; onRemove: () => void }) {
  const cart = useAddToCart(item.id);

  return (
    <li className="flex items-center gap-4 border-b border-border py-4 last:border-none">
      <Link href={item.href} className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-cream">
        <Image src={item.imageSrc} alt={item.imageAlt} fill sizes="80px" className="object-contain p-2" />
      </Link>
      <div className="flex-1">
        <Link href={item.href} className="font-medium text-charcoal hover:underline">
          {item.name}
        </Link>
        <p className="mt-1 font-number text-body text-charcoal">{formatPrice(item.price, item.currency)}</p>
        {!item.inStock && (
          <Badge variant="secondary" className="mt-1">
            Out of stock
          </Badge>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!item.inStock || !cart.isAvailable}
        onClick={() => cart.addToCart()}
      >
        <ShoppingCart /> Move to Cart
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${item.name}`} onClick={onRemove}>
        <Trash2 />
      </Button>
    </li>
  );
}
