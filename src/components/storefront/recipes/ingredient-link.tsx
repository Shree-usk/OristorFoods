"use client";

import { ShoppingCart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useAddToCart } from "@/hooks/use-add-to-cart";
import { formatIngredientLine } from "@/lib/recipe-scaling";
import type { RecipeIngredientItem } from "@/types/recipe";

interface IngredientLinkProps {
  ingredient: RecipeIngredientItem;
  /** Pre-scaled, pre-formatted display quantity, or null when the ingredient has no scalable amount. */
  scaledQuantity: string | null;
}

/** Compact add-to-cart affordance for an ingredient row — ProductActions' wishlist/compare controls don't belong at this scale. */
function AddToCartMini({ productId, inStock }: { productId: string; inStock: boolean }) {
  const cart = useAddToCart(productId);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="shrink-0"
      disabled={!inStock || !cart.isAvailable || cart.isAdding}
      onClick={() => cart.addToCart(1)}
      aria-label={cart.isAdding ? "Adding to cart" : "Add to cart"}
    >
      <ShoppingCart /> {inStock ? "Add" : "Out of stock"}
    </Button>
  );
}

export function IngredientLink({ ingredient, scaledQuantity }: IngredientLinkProps) {
  const label = formatIngredientLine(ingredient, scaledQuantity);
  const product = ingredient.product;

  if (!product) return <span>{label}</span>;

  return (
    <div className="flex items-center gap-3">
      {/* Decorative — the text link right after this carries the same href and is the real tab stop, so this one is skipped rather than duplicating it. */}
      <Link href={`/products/${product.slug}`} className="shrink-0" aria-hidden="true" tabIndex={-1}>
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.imageAlt ?? product.name} width={40} height={40} className="size-10 rounded-md border border-border-soft object-cover" />
        ) : (
          <span className="flex size-10 items-center justify-center rounded-md border border-border-soft bg-beige text-caption text-charcoal/40" aria-hidden="true">
            —
          </span>
        )}
      </Link>
      <Link href={`/products/${product.slug}`} className="min-w-0 flex-1 text-chilli underline-offset-2 hover:underline">
        {label}
      </Link>
      <AddToCartMini productId={product.id} inStock={product.inStock} />
    </div>
  );
}
