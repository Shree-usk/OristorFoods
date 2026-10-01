/**
 * Recipe Q&A types and constants shared by server and client code
 * (STORY-046.1). Keep this file free of server-only imports: client
 * components import from it. Deliberately lighter than question.ts
 * (Product Q&A) — no search/sort, no "my open questions" tracking,
 * per this story's lightweight scope.
 */

export type RecipeQuestionStatusValue = "Pending" | "Answered" | "Approved" | "Published" | "Rejected";

/** A Published question with its answer, as returned by the public API. */
export interface PublicRecipeQuestion {
  id: string;
  question: string;
  answer: string;
  /** ISO 8601 string. */
  publishedAt: string;
}

export interface RecipeQuestionPage {
  items: PublicRecipeQuestion[];
  total: number;
  page: number;
  pageSize: number;
}

export const RECIPE_QUESTION_PAGE_SIZE = 10;

export interface RecipeQuestionPageQuery {
  page: number;
  pageSize: number;
}
