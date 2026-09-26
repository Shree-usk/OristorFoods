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
