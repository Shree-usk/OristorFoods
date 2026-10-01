"use client";

import { useState } from "react";

import { RECIPE_QUESTION_PAGE_SIZE, type RecipeQuestionPage, type RecipeQuestionPageQuery } from "@/types/recipe-question";

import { AskRecipeQuestionForm } from "./ask-recipe-question-form";
import { RecipeQuestionsList } from "./recipe-questions-list";

interface RecipeQuestionsSectionProps {
  recipeSlug: string;
  /** Fetched by the recipe detail page (Server Component) via recipe-qa.service.ts's listPublishedQuestionsForRecipe. */
  initialQuestionPage: RecipeQuestionPage;
}

/** Mirrors questions-section.tsx (Product Q&A, STORY-016) and recipe-reviews-section.tsx's simplicity level — no search, no "my open questions". */
export function RecipeQuestionsSection({ recipeSlug, initialQuestionPage }: RecipeQuestionsSectionProps) {
  const [page, setPage] = useState(1);
  const query: RecipeQuestionPageQuery = { page, pageSize: RECIPE_QUESTION_PAGE_SIZE };

  return (
    <section aria-labelledby="recipe-questions-heading" className="flex flex-col gap-6">
      <h2 id="recipe-questions-heading" className="text-h3 font-heading text-charcoal">
        Questions &amp; Answers
      </h2>
      <RecipeQuestionsList recipeSlug={recipeSlug} initialPage={initialQuestionPage} query={query} onPageChange={setPage} />
      <AskRecipeQuestionForm recipeSlug={recipeSlug} />
    </section>
  );
}
