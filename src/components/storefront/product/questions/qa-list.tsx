"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { fetchQuestionPage } from "@/lib/api/question-client";
import { formatDisplayDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import type { QuestionPage, QuestionPageQuery } from "@/types/question";

interface QaListProps {
  productSlug: string;
  /** The server-rendered first page (no search). */
  initialPage: QuestionPage;
  query: QuestionPageQuery;
  onPageChange: (page: number) => void;
}

export function QaList({ productSlug, initialPage, query, onPageChange }: QaListProps) {
  const isInitialQuery = query.page === 1 && query.q === undefined;
  const { data, isError, isFetching } = useQuery({
    queryKey: ["questions", productSlug, query],
    queryFn: () => fetchQuestionPage(productSlug, query),
    initialData: isInitialQuery ? initialPage : undefined,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const emptyPage: QuestionPage = { items: [], total: 0, page: query.page, pageSize: query.pageSize };
  const page = data ?? (query.q ? emptyPage : initialPage);

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
        <p className="text-small text-charcoal/70">
          {query.q ? `No questions match “${query.q}”. Ask it below.` : "No questions yet. Be the first to ask."}
        </p>
      ) : (
        <ul className={cn("flex flex-col divide-y divide-charcoal/10", isFetching && "opacity-60")}>
          {page.items.map((item) => (
            <li key={item.id} className="py-4">
              <article aria-labelledby={`question-${item.id}-text`}>
                <h3 id={`question-${item.id}-text`} className="font-medium text-charcoal">
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
