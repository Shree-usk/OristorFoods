import type { HomepageLayoutDetail } from "@/repositories/homepage-layout.repository";
import { BestSellingProducts } from "@/components/storefront/home/best-selling-products";
import { CustomerReviews } from "@/components/storefront/home/customer-reviews";
import { ExportSolutions } from "@/components/storefront/home/export-solutions";
import { FeaturedCategories } from "@/components/storefront/home/featured-categories";
import { FeaturedRecipes } from "@/components/storefront/home/featured-recipes";
import { FoodAcademyTeaser } from "@/components/storefront/home/food-academy-teaser";
import { HeroBannerSlide } from "@/components/storefront/home/hero-banner-slide";
import { InstagramGallery } from "@/components/storefront/home/instagram-gallery";
import { ProductCollections } from "@/components/storefront/home/product-collections";
import { RewardsClubTeaser } from "@/components/storefront/home/rewards-club-teaser";
import { WhyChooseOristor } from "@/components/storefront/home/why-choose-oristor";
import { getFeaturedCategoriesForStorefront } from "@/services/category.service";
import { getRecentPostsForStorefront } from "@/services/instagram.service";
import type { CategoryCardData, InstagramPostData } from "@/types/home";
import {
  customerReviews,
  exportSolutions,
  featuredCategories,
  foodAcademyTeaser,
  instagramPosts,
  productCollections,
  rewardsClubTeaser,
  whyChooseFeatures,
} from "@/lib/fixtures/home-fixtures";

/**
 * STORY-042. Renders a HomepageLayout's visible sections in order — shared
 * by the real storefront page (the Published layout) and the admin
 * preview route (a Draft layout). Content for the 10 non-HeroBanner types
 * still comes from fixtures/real per-story data this pass (light-touch
 * scope — only visibility, order, and an optional title/description
 * override are admin-editable; see docs/architecture-decisions.md for the
 * full list of what's deferred).
 */
export async function HomepageSections({ layout }: { layout: HomepageLayoutDetail }) {
  const visibleSections = layout.sections.filter((section) => section.visible);

  const hasInstagramSection = visibleSections.some((section) => section.type === "InstagramGallery");
  const syncedInstagramPosts = hasInstagramSection ? await getRecentPostsForStorefront(12) : [];
  // Falls back to the fixture gallery until an admin connects a real
  // Instagram account (Settings > Integrations) — never an empty section.
  const resolvedInstagramPosts: InstagramPostData[] =
    syncedInstagramPosts.length > 0
      ? syncedInstagramPosts.map((post) => ({
          id: post.id,
          imageSrc: post.imageUrl,
          imageAlt: post.caption ? post.caption.slice(0, 120) : "Oristor Instagram post",
          href: post.permalink,
        }))
      : instagramPosts;

  const hasCategoriesSection = visibleSections.some((section) => section.type === "FeaturedCategories");
  const realCategories = hasCategoriesSection ? await getFeaturedCategoriesForStorefront(6) : [];
  // Falls back to the fixture gallery until an admin has activated and
  // given an image to at least one real Category (Admin > Categories) —
  // never an empty section.
  const resolvedCategories: CategoryCardData[] =
    realCategories.length > 0
      ? realCategories.map((category) => ({
          id: category.id,
          name: category.name,
          href: `/products/category/${category.slug}`,
          imageSrc: category.image!,
          imageAlt: category.name,
        }))
      : featuredCategories;

  return (
    <>
      {visibleSections.map((section) => {
        switch (section.type) {
          case "HeroBanner": {
            const slide = section.banners.filter((banner) => banner.visible).sort((a, b) => a.sortOrder - b.sortOrder)[0];
            // No visible slide yet (e.g. a freshly-published, still-empty
            // Hero Banner section) — nothing to render. A real deployment
            // always has at least one slide via the seed's initial
            // published layout; an admin publishing an empty one is a
            // self-inflicted, documented edge case (see
            // docs/architecture-decisions.md).
            if (!slide) return null;
            return (
              <HeroBannerSlide
                key={section.id}
                data={{
                  headline: slide.headline,
                  subheadline: slide.subheadline,
                  supportingText: slide.supportingText,
                  ctaLabel: slide.ctaLabel,
                  ctaHref: slide.ctaHref,
                  secondaryCtaLabel: slide.secondaryCtaLabel,
                  secondaryCtaHref: slide.secondaryCtaHref,
                  desktopImageUrl: slide.desktopImageUrl,
                  desktopImageAlt: slide.desktopImageAlt,
                  mobileImageUrl: slide.mobileImageUrl,
                  mobileImageAlt: slide.mobileImageAlt,
                  videoUrl: slide.videoUrl,
                  overlayEnabled: slide.overlayEnabled,
                  alignment: slide.alignment,
                }}
              />
            );
          }
          case "FeaturedCategories":
            return <FeaturedCategories key={section.id} categories={resolvedCategories} titleOverride={section.titleOverride} />;
          case "WhyChooseOristor":
            return <WhyChooseOristor key={section.id} features={whyChooseFeatures} titleOverride={section.titleOverride} />;
          case "BestSellingProducts":
            return <BestSellingProducts key={section.id} titleOverride={section.titleOverride} />;
          case "FeaturedRecipes":
            return <FeaturedRecipes key={section.id} titleOverride={section.titleOverride} />;
          case "ProductCollections":
            return <ProductCollections key={section.id} collections={productCollections} titleOverride={section.titleOverride} />;
          case "FoodAcademy":
            return (
              <FoodAcademyTeaser
                key={section.id}
                data={{ ...foodAcademyTeaser, headline: section.titleOverride || foodAcademyTeaser.headline, description: section.descriptionOverride || foodAcademyTeaser.description }}
              />
            );
          case "CustomerReviews":
            return <CustomerReviews key={section.id} reviews={customerReviews} titleOverride={section.titleOverride} />;
          case "ExportSolutions":
            return (
              <ExportSolutions
                key={section.id}
                data={{ ...exportSolutions, headline: section.titleOverride || exportSolutions.headline, description: section.descriptionOverride || exportSolutions.description }}
              />
            );
          case "RewardsClub":
            return (
              <RewardsClubTeaser
                key={section.id}
                data={{ ...rewardsClubTeaser, headline: section.titleOverride || rewardsClubTeaser.headline, description: section.descriptionOverride || rewardsClubTeaser.description }}
              />
            );
          case "InstagramGallery":
            return <InstagramGallery key={section.id} posts={resolvedInstagramPosts} titleOverride={section.titleOverride} descriptionOverride={section.descriptionOverride} />;
          default:
            return null;
        }
      })}
    </>
  );
}
