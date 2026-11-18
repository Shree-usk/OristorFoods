export interface FoodAcademyEntryCard {
  id: string;
  slug: string;
  href: string;
  title: string;
  summary: string;
  heroImageUrl: string | null;
  contentType: "Article" | "Guide" | "Course";
  categoryName: string;
  categorySlug: string;
  readingTimeMinutes: number | null;
  isFeatured: boolean;
}

export interface FoodAcademySectionData {
  id: string;
  sectionNumber: number;
  title: string;
  bodyContent: string;
  imageUrl: string | null;
}

export interface FoodAcademyEntryDetail extends FoodAcademyEntryCard {
  bodyContent: string | null;
  authorName: string | null;
  sections: FoodAcademySectionData[];
  relatedRecipes: import("@/services/product-detail-extensions").RecipePreview[];
  relatedProducts: import("@/types/product").ProductListItem[];
  relatedEntries: FoodAcademyEntryCard[];
}

export interface FoodAcademyListResult {
  entries: FoodAcademyEntryCard[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FoodAcademyCategoryTile {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tileImageUrl: string | null;
  tileImageAlt: string | null;
}

/** Public, merged-with-defaults shape of FoodAcademyPageSetting — see food-academy-page-setting.service.ts::getFoodAcademyPageSettingForStorefront. */
export interface FoodAcademyPageSettingData {
  enabled: boolean;
  heroEyebrow: string;
  heroHeading: string;
  heroDescription: string;
  heroPrimaryCtaLabel: string;
  heroPrimaryCtaHref: string;
  heroSecondaryCtaLabel: string;
  heroSecondaryCtaHref: string;
  heroImageUrl: string | null;
  heroImageAlt: string;
  heroBadgeText: string;
  exploreHeading: string;
  exploreDescription: string;
  featuredHeading: string;
  featuredDescription: string;
  instagramEnabled: boolean;
  instagramHeading: string;
  instagramDescription: string;
  instagramCtaLabel: string;
  instagramCtaHref: string;
  seoTitle: string;
  seoMetaDescription: string;
  seoCanonicalPath: string;
  seoOgImageUrl: string | null;
}
