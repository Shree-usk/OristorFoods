import type { Metadata } from "next";
import { ChevronDownIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Breadcrumbs } from "@/components/storefront/layout/breadcrumbs";
import { Section } from "@/components/storefront/layout/section";
import { BulletList } from "@/components/storefront/product/bullet-list";
import { BundleDisplay } from "@/components/storefront/product/bundle-display";
import { CertificationBadges } from "@/components/storefront/product/certification-badges";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RelatedRecipesBlock } from "@/components/storefront/food-academy/related-recipes-block";
import { FeaturedItems } from "@/components/storefront/product/featured-items";
import { FeaturedProductsRail } from "@/components/storefront/product/featured-products-rail";
import { IngredientsList } from "@/components/storefront/product/ingredients-list";
import { InspirationCards } from "@/components/storefront/product/inspiration-cards";
import { NutritionDisclosure } from "@/components/storefront/product/nutrition-disclosure";
import { ProductGallery } from "@/components/storefront/product/product-gallery";
import { ProductPurchasePanel } from "@/components/storefront/product/product-purchase-panel";
import { VariantSelectionProvider } from "@/components/storefront/product/variant-selection-context";
import { JsonLdScript } from "@/components/storefront/product/json-ld-script";
import { ProductJsonLd } from "@/components/storefront/product/product-json-ld";
import { RecentlyViewed, TrackRecentlyViewed } from "@/components/storefront/product/recently-viewed";
import { RecommendationRail } from "@/components/storefront/recommendations/recommendation-rail";
import { QuestionsSection } from "@/components/storefront/product/questions/questions-section";
import { formatRating, StarRating } from "@/components/storefront/product/reviews/star-rating";
import { ReviewsSection } from "@/components/storefront/product/reviews/reviews-section";
import { ShareButtons } from "@/components/storefront/product/share-buttons";
import { auth } from "@/lib/auth";
import { SITE_URL } from "@/lib/site-url";
import { resolveCustomerGroupForUser } from "@/services/pricing.service";
import { getProductDetail } from "@/services/product.service";
import { getFeaturedProducts, getFrequentlyBoughtTogether, getSimilarProducts } from "@/services/recommendation.service";

// getProductDetail() runs the full PDP aggregation (price resolution, 3
// extension-point summary calls, an ancestor-path walk, a best-effort
// View-interaction write) — generateMetadata and the page body both call
// it, so cache() dedupes the work to one call per request instead of
// running it twice per page view. "You May Also Like"/"Frequently Bought
// Together" are fetched separately (recommendation.service.ts) rather than
// from inside getProductDetail, since that service imports
// listRelatedProducts from product.service.ts as its own fallback — folding
// the call back in here would create a circular import.
const getCachedProductDetail = cache(getProductDetail);

interface ProductDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const session = await auth();
  const customerGroup = await resolveCustomerGroupForUser(session?.user?.id ?? null);
  const product = await getCachedProductDetail(slug, customerGroup, session?.user?.id ?? null);
  if (!product) return {};

  return {
    title: product.metaTitle ?? product.name,
    description: product.metaDescription ?? product.shortDescription ?? undefined,
    alternates: product.canonicalUrl ? { canonical: product.canonicalUrl } : undefined,
    robots: { index: product.robotsIndex, follow: product.robotsFollow },
  };
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  const session = await auth();
  const customerGroup = await resolveCustomerGroupForUser(session?.user?.id ?? null);
  const product = await getCachedProductDetail(slug, customerGroup, session?.user?.id ?? null);
  if (!product) notFound();

  const pageUrl = `${SITE_URL}/products/${product.slug}`;
  const [similarProducts, frequentlyBoughtTogether, featuredProducts] = await Promise.all([
    getSimilarProducts({ productId: product.id, categoryIds: product.categoryIds, customerGroup }),
    getFrequentlyBoughtTogether({ productId: product.id, customerGroup }),
    getFeaturedProducts({ excludeProductId: product.id, customerGroup }),
  ]);

  // Long description ("About this product"), Ingredients, Certifications/
  // Allergens, and the share icons — rendered once here and placed twice
  // below (desktop: left column under the gallery; mobile: original spot
  // in the right column), toggled with hidden/lg:hidden rather than kept
  // as separate markup. The short description moved into
  // ProductPurchasePanel instead (between "In stock" and the size
  // selector), so it's no longer part of this block.
  const extrasBlock = (
    <>
      {product.story && (
        <div className="mt-6">
          <h2 className="text-h4 font-heading text-charcoal">About this product</h2>
          <p className="mt-2 text-body text-charcoal">{product.story}</p>
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

      <CertificationBadges allergens={product.allergens} certifications={product.certifications} />

      <div className="mt-6">
        <ShareButtons url={pageUrl} title={product.name} />
      </div>
    </>
  );

  return (
    <Section>
      {product.jsonLdOverride ? (
        <JsonLdScript data={product.jsonLdOverride} />
      ) : (
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
      )}
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
            href: `/products/category/${category.slug}`,
          })),
          { name: product.name, href: `/products/${product.slug}` },
        ]}
      />

      {/*
        Two independent column cells (not a single multi-row grid) — CSS
        Grid shares row-track heights across every column, so a flat grid
        with per-item row-start numbers made the right column's rows snap
        to the left column's (much taller) image row instead of stacking
        on their own. Each column below is one grid cell that lays out its
        own children independently, exactly like before this change.

        "About this product", Ingredients, Certifications/Allergens, and
        the share icons render TWICE — once inside the left column
        (desktop only, filling the dead space under the image) and once
        in their original spot inside the right column (mobile only, so
        phones keep today's order with Add to Cart straight after the
        image, unchanged). Both copies come from the same `extrasBlock`
        JSX value, toggled with hidden/lg:hidden rather than duplicated
        markup — a standard responsive pattern already used for this
        site's mobile nav (header.tsx/mobile-nav.tsx) and filter drawer.
      */}
      <VariantSelectionProvider variants={product.variants}>
        <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div>
            <ProductGallery images={product.images} videos={product.videos} variants={product.variants} productName={product.name} />
            <div className="hidden lg:block">{extrasBlock}</div>
          </div>

          <div>
            <h1 className="text-h1 font-heading text-charcoal">{product.name}</h1>
            {product.reviewSummary && product.reviewSummary.reviewCount > 0 ? (
              <a href="#reviews-heading" className="mt-2 flex items-center gap-2 text-small text-charcoal/70 hover:text-charcoal">
                <StarRating rating={product.reviewSummary.averageRating} />
                <span>
                  {formatRating(product.reviewSummary.averageRating)} ({product.reviewSummary.reviewCount}{" "}
                  {product.reviewSummary.reviewCount === 1 ? "review" : "reviews"})
                </span>
              </a>
            ) : (
              <a href="#reviews-heading" className="mt-2 flex items-center gap-2 text-small text-charcoal/70 hover:text-charcoal">
                <StarRating rating={0} />
                <span>No reviews yet — be the first to review</span>
              </a>
            )}
            <div className="mt-2">
              <ProductPurchasePanel
                productId={product.id}
                price={product.price}
                originalPrice={product.originalPrice}
                currency={product.currency}
                inStock={product.inStock}
                rewardPoints={product.rewardPoints}
                shortDescription={product.shortDescription}
                variants={product.variants}
                packagingOptions={product.packagingOptions}
              />
            </div>

            {product.bundle && (
              <div className="mt-6">
                <BundleDisplay bundle={product.bundle} items={product.bundleItems} />
              </div>
            )}

            <div className="lg:hidden">{extrasBlock}</div>

            <div className="mt-6 space-y-2">
              {product.servingSuggestions.length > 0 && (
                <Collapsible defaultOpen={false}>
                  <CollapsibleTrigger className="group/serving-trigger flex w-full items-center justify-between rounded-lg border border-charcoal/10 px-4 py-3 text-left">
                    <h2 className="text-h4 font-heading text-charcoal">Serving Suggestions</h2>
                    <ChevronDownIcon className="size-5 text-charcoal/60 transition duration-200 group-data-panel-open/serving-trigger:rotate-180" aria-hidden="true" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 pb-3">
                    <BulletList heading="Serving Suggestions" items={product.servingSuggestions} headingLevel="h2" hideHeading />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {product.benefits.length > 0 && (
                <Collapsible defaultOpen={false}>
                  <CollapsibleTrigger className="group/benefits-trigger flex w-full items-center justify-between rounded-lg border border-charcoal/10 px-4 py-3 text-left">
                    <h2 className="text-h4 font-heading text-charcoal">Benefits</h2>
                    <ChevronDownIcon className="size-5 text-charcoal/60 transition duration-200 group-data-panel-open/benefits-trigger:rotate-180" aria-hidden="true" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 pb-3">
                    <BulletList heading="Benefits" items={product.benefits} headingLevel="h2" hideHeading />
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>

            {product.nutrition && (
              <div className="mt-6">
                <NutritionDisclosure nutrition={product.nutrition} />
              </div>
            )}
          </div>
        </div>
      </VariantSelectionProvider>

      <div className="mt-12">
        <FeaturedItems items={product.featuredItems} />
      </div>

      <RelatedRecipesBlock
        recipes={product.recipeSummary?.recipes ?? []}
        heading="Recipes Using This Product"
        emptyMessage="Recipes for this product are coming soon."
      />

      <div className="mt-12">
        <InspirationCards cards={product.inspirationCards} />
      </div>

      <div className="mt-12">
        <ReviewsSection productSlug={product.slug} summary={product.reviewSummary} />
      </div>

      <div className="mt-12">
        <QuestionsSection productSlug={product.slug} summary={product.qaSummary} />
      </div>

      {frequentlyBoughtTogether.length > 0 && (
        <div className="mt-12">
          <RecommendationRail title="Frequently Bought Together" products={frequentlyBoughtTogether} placement="Pdp" />
        </div>
      )}
      <div className="mt-12">
        <RecommendationRail title="You May Also Like" products={similarProducts} placement="Pdp" />
      </div>
      {featuredProducts.length > 0 && (
        <div className="mt-12">
          <FeaturedProductsRail title="Featured Products" products={featuredProducts} />
        </div>
      )}
      <div className="mt-12">
        <RecentlyViewed excludeProductId={product.id} />
      </div>
    </Section>
  );
}
