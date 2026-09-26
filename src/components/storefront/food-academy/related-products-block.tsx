import { ProductCard } from "@/components/storefront/product/product-card";
import type { ProductListItem } from "@/types/product";

export function RelatedProductsBlock({ products }: { products: ProductListItem[] }) {
  if (products.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-h4 font-heading text-charcoal">Products used</h2>
      <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
