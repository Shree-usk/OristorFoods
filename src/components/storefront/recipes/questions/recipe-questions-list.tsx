"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { fetchRecipeQuestionPage } from "@/lib/api/recipe-question-client";
import { formatDisplayDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import type { RecipeQuestionPage, RecipeQuestionPageQuery } from "@/types/recipe-question";

interface RecipeQuestionsListProps {
  recipeSlug: string;
  /** The server-rendered first page. */
  initialPage: RecipeQuestionPage;
  query: RecipeQuestionPageQuery;
  onPageChange: (page: number) => void;
}

/** Mirrors qa-list.tsx (Product Q&A) minus the search affordance — not built for this lightweight story. */
export function RecipeQuestionsList({ recipeSlug, initialPage, query, onPageChange }: RecipeQuestionsListProps) {
  const isInitialQuery = query.page === 1;
  const { data, isError, isFetching } = useQuery({
    queryKey: ["recipe-questions", recipeSlug, query],
    queryFn: () => fetchRecipeQuestionPage(recipeSlug, query),
    initialData: isInitialQuery ? initialPage : undefined,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const page = data ?? initialPage;

  const from = page.total === 0 ? 0 : (page.page - 1) * page.pageSize + 1;
  const to = Math.min(page.page * page.pageSize, page.total);
  const lastPage = Math.max(1, Math.ceil(page.total / page.pageSize));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-small text-charcoal/70" aria-live="polite">
        {page.total > 0 ? `Showing ${from}–${to} of ${page.total} questions` : ""}
      </p>

      {isError && (
        <p role="alert" className="text-small text-destructive">
          Couldn&apos;t load questions. Please try again.
        </p>
      )}

      {page.items.length === 0 ? (
        <p className="text-small text-charcoal/70">No questions yet. Be the first to ask.</p>
      ) : (
        <ul className={cn("flex flex-col divide-y divide-charcoal/10", isFetching && "opacity-60")}>
          {page.items.map((item) => (
            <li key={item.id} className="py-4">
              <article aria-labelledby={`recipe-question-${item.id}-text`}>
                <h3 id={`recipe-question-${item.id}-text`} className="font-medium text-charcoal">
                  {item.question}
                </h3>
                <p className="mt-1 text-small whitespace-pre-line text-charcoal">{item.answer}</p>
                <p className="mt-2 text-caption text-charcoal/70">
                  Answered by Oristor · <time dateTime={item.publishedAt}>{formatDisplayDate(item.publishedAt)}</time>
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}

      {lastPage > 1 && (
        <nav aria-label="Question pages" className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={query.page <= 1} onClick={() => onPageChange(query.page - 1)}>
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={query.page >= lastPage}
            onClick={() => onPageChange(query.page + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
