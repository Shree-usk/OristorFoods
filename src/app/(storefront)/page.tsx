import { connection } from "next/server";

import { BestSellingProducts } from "@/components/storefront/home/best-selling-products";
import { CustomerReviews } from "@/components/storefront/home/customer-reviews";
import { ExportSolutions } from "@/components/storefront/home/export-solutions";
import { FeaturedCategories } from "@/components/storefront/home/featured-categories";
import { FeaturedRecipes } from "@/components/storefront/home/featured-recipes";
import { FoodAcademyTeaser } from "@/components/storefront/home/food-academy-teaser";
import { HeroBanner } from "@/components/storefront/home/hero-banner";
import { HomepageSections } from "@/components/storefront/home/homepage-sections";
import { InstagramGallery } from "@/components/storefront/home/instagram-gallery";
import { ProductCollections } from "@/components/storefront/home/product-collections";
import { RewardsClubTeaser } from "@/components/storefront/home/rewards-club-teaser";
import { WhyChooseOristor } from "@/components/storefront/home/why-choose-oristor";
import {
  customerReviews,
  exportSolutions,
  featuredCategories,
  foodAcademyTeaser,
  heroBanner,
  instagramPosts,
  productCollections,
  rewardsClubTeaser,
  whyChooseFeatures,
} from "@/lib/fixtures/home-fixtures";
import { getPublishedHomepageLayout } from "@/services/homepage.service";

/**
 * Homepage — every section in the exact order from docs/blueprint.md
 * Section 4. Section order/visibility and Hero Banner content are
 * admin-editable via STORY-042's Homepage Builder once a layout has been
 * published; the other 10 sections' actual content is still typed fixture
 * data (light-touch scope this pass — see docs/architecture-decisions.md).
 *
 * **Fallback, never blank:** if no HomepageLayout has ever been
 * published (a fresh environment before the seed/an admin publishes
 * anything), this renders the exact original STORY-006 fixture-driven
 * list below instead — the migration must never leave the storefront
 * broken.
 *
 * Blueprint's homepage section list ends "... Newsletter → Footer" — the
 * Newsletter form already lives inside the site-wide `<Footer>`
 * (STORY-005), which renders immediately after this page in
 * `(storefront)/layout.tsx`. A second, separate newsletter section here
 * would duplicate that exact same form. See docs/architecture-decisions.md
 * for the full reasoning.
 */
export default async function Home() {
  // Forces this route dynamic explicitly, rather than relying on a nested
  // section (e.g. FeaturedRecipes' own connection() call) to do it —
  // whether that section renders at all depends on which sections the
  // currently-published layout happens to include, so it can't be trusted
  // to keep this route dynamic on its own. Without this, a published
  // layout that omits every section using a dynamic API can get
  // statically cached, silently serving a stale layout after future
  // publishes/rollbacks (found while testing STORY-042's publish flow).
  await connection();
  const layout = await getPublishedHomepageLayout();
  if (layout) return <HomepageSections layout={layout} />;

  return (
    <>
      <HeroBanner data={heroBanner} />
      <FeaturedCategories categories={featuredCategories} />
      <WhyChooseOristor features={whyChooseFeatures} />
      <BestSellingProducts />
      <FeaturedRecipes />
      <ProductCollections collections={productCollections} />
      <FoodAcademyTeaser data={foodAcademyTeaser} />
      <CustomerReviews reviews={customerReviews} />
      <ExportSolutions data={exportSolutions} />
      <RewardsClubTeaser data={rewardsClubTeaser} />
      <InstagramGallery posts={instagramPosts} />
    </>
  );
}
