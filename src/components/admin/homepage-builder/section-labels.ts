import type { HomepageSectionType } from "@/lib/api/admin-homepage-builder-client";

/**
 * Display order and names — shared between the builder canvas and the
 * "Add section" picker. Originally blueprint Section 4's exact order;
 * the Homepage/Header redesign moved WhyChooseOristor to right after
 * HeroBanner and CustomerReviews to right after FeaturedCategories (see
 * homepage-builder.service.ts's DEFAULT_SECTION_ORDER).
 */
export const SECTION_TYPE_ORDER: HomepageSectionType[] = [
  "HeroBanner",
  "WhyChooseOristor",
  "FeaturedCategories",
  "CustomerReviews",
  "BestSellingProducts",
  "FeaturedRecipes",
  "ProductCollections",
  "FoodAcademy",
  "ExportSolutions",
  "PerfectMatch",
  "RewardsClub",
  "InstagramGallery",
];

export const SECTION_TYPE_LABELS: Record<HomepageSectionType, string> = {
  HeroBanner: "Hero Banner",
  FeaturedCategories: "Featured Categories",
  WhyChooseOristor: "Why Choose Oristor",
  BestSellingProducts: "Best Selling Products",
  FeaturedRecipes: "Featured Recipes",
  ProductCollections: "Product Collections",
  FoodAcademy: "Food Academy",
  CustomerReviews: "Customer Reviews",
  ExportSolutions: "Export Solutions",
  PerfectMatch: "The Perfect Match",
  RewardsClub: "Rewards Club",
  InstagramGallery: "Instagram Gallery",
};
