import Image from "next/image";
import Link from "next/link";

import { ProductActions } from "@/components/storefront/product/product-actions";
import type { RecipeIngredientProduct } from "@/types/recipe";

function formatPrice(price: RecipeIngredientProduct["price"]): string | null {
  if (!price) return null;
  return `${price.currency} ${price.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** The distinct real products this recipe's ingredients link to, each with a direct Add to Cart — same data recipe.ingredients already carries, deduped by the service layer (recipe.service.ts::toFeaturedProducts). */
export function FeaturedRecipeProducts({ products }: { products: RecipeIngredientProduct[] }) {
  if (products.length === 0) return null;

  return (
    <div>
      <h2 className="text-center text-h3 font-heading text-charcoal">Featured in this Recipe</h2>
      <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => {
          const price = formatPrice(product.price);
          return (
            <div key={product.id} className="flex flex-col rounded-lg border border-border-soft p-4">
              <Link href={`/products/${product.slug}`}>
                <div className="relative aspect-square overflow-hidden rounded-md bg-white">
                  {product.imageUrl ? (
                    <Image src={product.imageUrl} alt={product.imageAlt ?? product.name} fill sizes="(min-width: 1024px) 25vw, 45vw" className="object-contain p-3" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-small text-charcoal/40">No image available</div>
                  )}
                </div>
              </Link>
              <Link href={`/products/${product.slug}`} className="mt-3 text-body font-heading text-charcoal hover:underline">
                {product.name}
              </Link>
              {price && <p className="mt-1 text-small text-charcoal/70">{price}</p>}
              <div className="mt-3">
                <ProductActions productId={product.id} inStock={product.inStock} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
