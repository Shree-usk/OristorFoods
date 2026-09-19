import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/storefront/layout/breadcrumbs";
import { Section } from "@/components/storefront/layout/section";
import { BulletList } from "@/components/storefront/product/bullet-list";
import { IngredientsList } from "@/components/storefront/product/ingredients-list";
import { NutritionTable } from "@/components/storefront/product/nutrition-table";
import { ProductActions } from "@/components/storefront/product/product-actions";
import { ProductGallery } from "@/components/storefront/product/product-gallery";
import { ProductJsonLd } from "@/components/storefront/product/product-json-ld";
import { RecentlyViewed, TrackRecentlyViewed } from "@/components/storefront/product/recently-viewed";
import { RelatedProducts } from "@/components/storefront/product/related-products";
import { ShareButtons } from "@/components/storefront/product/share-buttons";
import { getProductDetail } from "@/services/product.service";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oristor.com";

interface ProductDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) return {};

  return {
    title: product.metaTitle ?? product.name,
    description: product.metaDescription ?? product.shortDescription ?? undefined,
    alternates: product.canonicalUrl ? { canonical: product.canonicalUrl } : undefined,
  };
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) notFound();

  const pageUrl = `${SITE_URL}/products/${product.slug}`;

  return (
    <Section>
      <ProductJsonLd
        name={product.name}
        description={product.shortDescription}
        imageUrls={product.images.map((image) => image.url)}
        sku={product.sku}
        price={product.price}
        currency={product.currency}
        inStock={product.inStock}
        url={pageUrl}
        averageRating={product.reviewSummary?.averageRating}
        reviewCount={product.reviewSummary?.reviewCount}
      />
      <TrackRecentlyViewed
        product={{
          id: product.id,
          name: product.name,
          href: `/products/${product.slug}`,
          imageSrc: product.images[0]?.url ?? "",
          imageAlt: product.images[0]?.altText ?? product.name,
          price: product.price,
          currency: product.currency,
          inStock: product.inStock,
        }}
      />
      <Breadcrumbs
        items={[
          ...product.categoryPath.map((category) => ({
            name: category.name,
            href: `/products/${category.slug}`,
          })),
          { name: product.name, href: `/products/${product.slug}` },
        ]}
      />

      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <ProductGallery images={product.images} videos={product.videos} productName={product.name} />

        <div>
          <h1 className="text-h1 font-heading text-charcoal">{product.name}</h1>
          <div className="mt-2 flex items-center gap-2 font-number text-h3 text-charcoal">
            <span>
              {product.currency} {product.price.toLocaleString()}
            </span>
            {product.originalPrice && (
              <span className="text-body text-charcoal/50 line-through">
                {product.currency} {product.originalPrice.toLocaleString()}
              </span>
            )}
          </div>
          <p className="mt-1 text-caption text-charcoal/70">
            Earn {product.rewardPoints} reward points with this purchase
          </p>
          <p className="mt-1 text-small text-charcoal/70">
            {product.inStock ? "In stock — ships within 2-3 business days" : "Currently out of stock"}
          </p>

          <div className="mt-6">
            <ProductActions productId={product.id} inStock={product.inStock} />
          </div>

          {product.story && <p className="mt-6 text-body text-charcoal">{product.story}</p>}

          {product.bundleItems.length > 0 && (
            <div className="mt-6">
              <h2 className="text-h4 font-heading text-charcoal">This bundle includes</h2>
              <ul className="mt-2 space-y-1 text-small text-charcoal">
                {product.bundleItems.map((item) => (
                  <li key={item.productId}>
                    {item.quantity} x {item.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6">
            <BulletList heading="Benefits" items={product.benefits} />
          </div>
          <div className="mt-6">
            <BulletList heading="Serving Suggestions" items={product.servingSuggestions} />
          </div>

          {product.nutrition && (
            <div className="mt-6">
              <h2 className="text-h4 font-heading text-charcoal">Nutrition Facts</h2>
              <div className="mt-2">
                <NutritionTable nutrition={product.nutrition} />
              </div>
            </div>
          )}

          {product.ingredients.length > 0 && (
            <div className="mt-6">
              <h2 className="text-h4 font-heading text-charcoal">Ingredients</h2>
              <div className="mt-2">
                <IngredientsList ingredients={product.ingredients} />
              </div>
            </div>
          )}

          <div className="mt-6">
            <ShareButtons url={pageUrl} title={product.name} />
          </div>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-h3 font-heading text-charcoal">Recipes Using This Product</h2>
        {product.recipeSummary && product.recipeSummary.recipes.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {product.recipeSummary.recipes.map((recipe) => (
              <a key={recipe.id} href={`/recipes/${recipe.slug}`} className="block text-small text-charcoal">
                {recipe.title}
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-small text-charcoal/70">Recipes for this product are coming soon.</p>
        )}
      </div>

      <div className="mt-12">
        <h2 className="text-h3 font-heading text-charcoal">Customer Reviews</h2>
        {product.reviewSummary ? (
          <div className="mt-4">
            <p className="font-number text-body text-charcoal">
              {product.reviewSummary.averageRating.toFixed(1)} / 5 ({product.reviewSummary.reviewCount} reviews)
            </p>
            <ul className="mt-4 space-y-4">
              {product.reviewSummary.previewReviews.map((review) => (
                <li key={review.id} className="border-b border-charcoal/10 pb-4">
                  <p className="font-medium text-charcoal">{review.title}</p>
                  <p className="text-small text-charcoal/70">{review.body}</p>
                  <p className="mt-1 text-caption text-charcoal/50">— {review.authorName}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-2 text-small text-charcoal/70">No reviews yet.</p>
        )}
      </div>

      <div className="mt-12">
        <h2 className="text-h3 font-heading text-charcoal">Questions & Answers</h2>
        {product.qaSummary && product.qaSummary.previewItems.length > 0 ? (
          <ul className="mt-4 space-y-4">
            {product.qaSummary.previewItems.map((qa) => (
              <li key={qa.id} className="border-b border-charcoal/10 pb-4">
                <p className="font-medium text-charcoal">{qa.question}</p>
                <p className="text-small text-charcoal/70">{qa.answer}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-small text-charcoal/70">No questions yet.</p>
        )}
      </div>

      <div className="mt-12">
        <RelatedProducts products={product.relatedProducts} />
      </div>
      <div className="mt-12">
        <RecentlyViewed excludeProductId={product.id} />
      </div>
    </Section>
  );
}
