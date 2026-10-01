import { readApiError, type ApiError } from "@/lib/api/api-error";
import type { RecipeQuestionPage, RecipeQuestionPageQuery } from "@/types/recipe-question";
import type { RecipeQuestionInput } from "@/validation/recipe-question.schema";

/** Browser-side wrapper around the recipe questions API (STORY-046.1). */
export type RecipeQuestionApiError = ApiError<keyof RecipeQuestionInput>;

function questionsUrl(recipeSlug: string): string {
  return `/api/recipes/${encodeURIComponent(recipeSlug)}/questions`;
}

export async function fetchRecipeQuestionPage(recipeSlug: string, query: RecipeQuestionPageQuery): Promise<RecipeQuestionPage> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  const response = await fetch(`${questionsUrl(recipeSlug)}?${params.toString()}`);
  if (!response.ok) throw await readApiError<keyof RecipeQuestionInput>(response);
  return (await response.json()) as RecipeQuestionPage;
}

export async function postRecipeQuestion(recipeSlug: string, input: RecipeQuestionInput): Promise<void> {
  const response = await fetch(questionsUrl(recipeSlug), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await readApiError<keyof RecipeQuestionInput>(response);
}
