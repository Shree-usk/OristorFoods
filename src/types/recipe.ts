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
  hasVideo: boolean;
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

export interface RecipeIngredientItem {
  id: string;
  /** null when the ingredient has no scalable amount ("Salt, to taste"). */
  quantity: number | null;
  unit: string | null;
  displayText: string;
  /** null when this ingredient has no matching Oristor product. */
  product: { id: string; slug: string; name: string } | null;
}

export interface RecipeStepItem {
  stepNumber: number;
  instruction: string;
  imageUrl: string | null;
}

export interface RecipeNutrition {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sodium: number | null;
}

export interface RecipeDetail {
  id: string;
  slug: string;
  href: string;
  title: string;
  shortDescription: string;
  heroImage: string;
  heroImageAlt: string;
  galleryImageUrls: string[];
  categoryName: string;
  categorySlug: string;
  cuisine: string | null;
  difficulty: "Easy" | "Medium" | "Hard";
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  totalTimeMinutes: number;
  servings: number;
  avgRating: number | null;
  ratingCount: number;
  dietaryTags: RecipeFacetOption[];
  chefNotes: string | null;
  nutrition: RecipeNutrition;
  ingredients: RecipeIngredientItem[];
  steps: RecipeStepItem[];
  metaTitle: string | null;
  metaDescription: string | null;
  publishedAt: string | null;
  relatedRecipes: RecipeCard[];
  video: { url: string; provider: "Youtube" | "Vimeo" | "SelfHosted"; durationSeconds: number | null; captionsUrl: string | null } | null;
}
