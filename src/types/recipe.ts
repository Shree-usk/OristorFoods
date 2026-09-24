/** One recipe card, used by the /recipes grid, the homepage and GET /api/recipes. */
export interface RecipeCard {
  id: string;
  slug: string;
  /** `/recipes/${slug}` (the detail page is STORY-018). */
  href: string;
  title: string;
  heroImage: string;
  heroImageAlt: string;
  categoryName: string;
  cuisine: string | null;
  difficulty: "Easy" | "Medium" | "Hard";
  totalTimeMinutes: number;
  /** null until the recipe has ratings (STORY-022). */
  avgRating: number | null;
  ratingCount: number;
  /** Active dietary tag names, in tag sortOrder. */
  dietaryTags: string[];
}

export interface RecipeListResult {
  recipes: RecipeCard[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RecipeFacetOption {
  name: string;
  slug: string;
}

export interface RecipeFacets {
  categories: RecipeFacetOption[];
  dietaryTags: RecipeFacetOption[];
}
