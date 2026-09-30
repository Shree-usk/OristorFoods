import type { HomepageSectionType } from "@/lib/api/admin-homepage-builder-client";

/** STORY-042. Blueprint Section 4's exact order and display names — shared between the builder canvas and the "Add section" picker. */
export const SECTION_TYPE_ORDER: HomepageSectionType[] = [
  "HeroBanner",
  "FeaturedCategories",
  "WhyChooseOristor",
  "BestSellingProducts",
  "FeaturedRecipes",
  "ProductCollections",
  "FoodAcademy",
  "CustomerReviews",
  "ExportSolutions",
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
  RewardsClub: "Rewards Club",
  InstagramGallery: "Instagram Gallery",
};
