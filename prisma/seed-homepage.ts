import { prisma } from "../src/lib/db";

/**
 * STORY-042 (Homepage Visual Builder — core scope). Creates and publishes
 * one initial HomepageLayout with the 11 default sections and a single
 * Hero Banner slide matching STORY-006's original fixture-driven default
 * — so a fresh environment's storefront homepage reflects a real
 * published layout from day one, rather than relying on page.tsx's
 * fixture fallback (which exists only as a never-blank safety net, not
 * the intended steady state). Section order follows
 * homepage-builder.service.ts's DEFAULT_SECTION_ORDER (Homepage/Header
 * redesign: WhyChooseOristor sits right after HeroBanner, not in its
 * original blueprint spot) — its 4 benefit items match
 * home-fixtures.ts's whyChooseFeatures exactly, so publishing this seed
 * causes no visual change versus the fixture fallback it replaces.
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
          {
            type: "WhyChooseOristor",
            sortOrder: 1,
            features: {
              create: [
                {
                  sortOrder: 0,
                  icon: "Leaf",
                  title: "Authentic Sri Lankan Recipes",
                  description: "Made the traditional way, passed down through generations of Sri Lankan kitchens.",
                },
                {
                  sortOrder: 1,
                  icon: "ShieldCheck",
                  title: "Premium Quality, Verified",
                  description: "Every batch is quality-checked so what you taste is always what you expect.",
                },
                {
                  sortOrder: 2,
                  icon: "Users",
                  title: "Trusted by Thousands",
                  description: "A loyal community of home cooks and the Sri Lankan diaspora across the world.",
                },
                {
                  sortOrder: 3,
                  icon: "Award",
                  title: "Sustainably Sourced",
                  description: "Ingredients sourced responsibly from Sri Lankan farms and producers.",
                },
              ],
            },
          },
          { type: "FeaturedCategories", sortOrder: 2 },
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
