import { ProductCard } from "@/components/storefront/product/product-card";
import type { ProductListItem } from "@/types/product";

export function RelatedProducts({ products }: { products: ProductListItem[] }) {
  if (products.length === 0) return null;
  return (
    <div>
      <h2 className="text-h3 font-heading text-charcoal">You May Also Like</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
