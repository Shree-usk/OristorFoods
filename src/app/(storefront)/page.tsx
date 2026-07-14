import { BestSellingProducts } from "@/components/storefront/home/best-selling-products";
import { CustomerReviews } from "@/components/storefront/home/customer-reviews";
import { ExportSolutions } from "@/components/storefront/home/export-solutions";
import { FeaturedCategories } from "@/components/storefront/home/featured-categories";
import { FeaturedRecipes } from "@/components/storefront/home/featured-recipes";
import { FoodAcademyTeaser } from "@/components/storefront/home/food-academy-teaser";
import { HeroBanner } from "@/components/storefront/home/hero-banner";
import { InstagramGallery } from "@/components/storefront/home/instagram-gallery";
import { ProductCollections } from "@/components/storefront/home/product-collections";
import { RewardsClubTeaser } from "@/components/storefront/home/rewards-club-teaser";
import { WhyChooseOristor } from "@/components/storefront/home/why-choose-oristor";
import {
  bestSellingProducts,
  customerReviews,
  exportSolutions,
  featuredCategories,
  featuredRecipes,
  foodAcademyTeaser,
  heroBanner,
  instagramPosts,
  productCollections,
  rewardsClubTeaser,
  whyChooseFeatures,
} from "@/lib/fixtures/home-fixtures";

/**
 * Homepage — every section in the exact order from docs/blueprint.md
 * Section 4. All content below Hero is typed fixture data (see
 * src/lib/fixtures/home-fixtures.ts) pending the Product Platform,
 * Recipes, Reviews, Food Academy, Export, and Rewards epics.
 *
 * Blueprint's homepage section list ends "... Newsletter → Footer" — the
 * Newsletter form already lives inside the site-wide `<Footer>`
 * (STORY-005), which renders immediately after this page in
 * `(storefront)/layout.tsx`. A second, separate newsletter section here
 * would duplicate that exact same form. See docs/architecture-decisions.md
 * for the full reasoning.
 */
export default function Home() {
  return (
    <>
      <HeroBanner data={heroBanner} />
      <FeaturedCategories categories={featuredCategories} />
      <WhyChooseOristor features={whyChooseFeatures} />
      <BestSellingProducts products={bestSellingProducts} />
      <FeaturedRecipes recipes={featuredRecipes} />
      <ProductCollections collections={productCollections} />
      <FoodAcademyTeaser data={foodAcademyTeaser} />
      <CustomerReviews reviews={customerReviews} />
      <ExportSolutions data={exportSolutions} />
      <RewardsClubTeaser data={rewardsClubTeaser} />
      <InstagramGallery posts={instagramPosts} />
    </>
  );
}
