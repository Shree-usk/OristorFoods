/**
 * The recipe listing's URL/API contract (STORY-017). Shared by the Zod query
 * schema, the nuqs URL parsers, the repository's query builders and the
 * filter UI, so every layer agrees on the same values and labels.
 */
export const recipeSortValues = ["newest", "popular", "rating", "time"] as const;
export type RecipeSort = (typeof recipeSortValues)[number];

export const recipeDifficultyValues = ["easy", "medium", "hard"] as const;
export type RecipeDifficultyParam = (typeof recipeDifficultyValues)[number];

/** Half-open ranges on total time: under-15 < 15 ≤ 15-30 < 30 ≤ 30-60 < 60 ≤ 60-plus. */
export const recipeTimeValues = ["under-15", "15-30", "30-60", "60-plus"] as const;
export type RecipeTimeRange = (typeof recipeTimeValues)[number];

export const recipeSortLabels: Record<RecipeSort, string> = {
  newest: "Newest",
  popular: "Most Popular",
  rating: "Highest Rated",
  time: "Cook Time (shortest first)",
};

export const recipeDifficultyLabels: Record<RecipeDifficultyParam, "Easy" | "Medium" | "Hard"> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export const recipeTimeLabels: Record<RecipeTimeRange, string> = {
  "under-15": "Under 15 min",
  "15-30": "15–30 min",
  "30-60": "30–60 min",
  "60-plus": "60+ min",
};

/** Filters only; sort and pagination travel separately. */
export interface RecipeFilters {
  category?: string;
  difficulty?: RecipeDifficultyParam[];
  time?: RecipeTimeRange[];
  /** Dietary tag slugs; a recipe must have every one. */
  diet?: string[];
  q?: string;
}
