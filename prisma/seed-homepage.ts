import { prisma } from "../src/lib/db";

/**
 * STORY-042 (Homepage Visual Builder — core scope). Creates and publishes
 * one initial HomepageLayout with the 11 default sections in blueprint
 * Section 4 order and a single Hero Banner slide matching STORY-006's
 * original fixture-driven default — so a fresh environment's storefront
 * homepage reflects a real published layout from day one, rather than
 * relying on page.tsx's fixture fallback (which exists only as a
 * never-blank safety net, not the intended steady state).
 */
export async function seedHomepage() {
  const layout = await prisma.homepageLayout.create({
    data: {
      status: "Published",
      publishedAt: new Date(),
      sections: {
        create: [
          {
            type: "HeroBanner",
            sortOrder: 0,
            banners: {
              create: [
                {
                  sortOrder: 0,
                  headline: "Feel the Difference",
                  subheadline:
                    "Authentic Sri Lankan flavors, crafted the traditional way and brought to your table with premium quality you can trust.",
                  ctaLabel: "Shop Best Sellers",
                  ctaHref: "/products?collection=best-sellers",
                  desktopImageUrl: "/images/products/misc/Bottles-group.webp",
                  desktopImageAlt: "A curated group of Oristor jars and bottles",
                  alignment: "Left",
                },
              ],
            },
          },
          { type: "FeaturedCategories", sortOrder: 1 },
          { type: "WhyChooseOristor", sortOrder: 2 },
          { type: "BestSellingProducts", sortOrder: 3 },
          { type: "FeaturedRecipes", sortOrder: 4 },
          { type: "ProductCollections", sortOrder: 5 },
          { type: "FoodAcademy", sortOrder: 6 },
          { type: "CustomerReviews", sortOrder: 7 },
          { type: "ExportSolutions", sortOrder: 8 },
          { type: "RewardsClub", sortOrder: 9 },
          { type: "InstagramGallery", sortOrder: 10 },
        ],
      },
    },
  });

  return { layoutId: layout.id, sections: 11 };
}
