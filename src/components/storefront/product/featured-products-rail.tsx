import { ProductCard } from "@/components/storefront/product/product-card";
import type { ProductListItem } from "@/types/product";

/**
 * Admin-curated (Product.isFeatured), unlike RecommendationRail's
 * algorithmic Similar/Frequently Bought Together rails on the same page —
 * deliberately a plain Server Component with no impression/click tracking,
 * since this isn't output from the AI recommendation system and has no
 * RecommendationPlacement value to log against.
 */
export function FeaturedProductsRail({ title, products }: { title: string; products: ProductListItem[] }) {
  if (products.length === 0) return null;

  return (
    <div>
      <h2 className="text-h3 font-heading text-charcoal">{title}</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
