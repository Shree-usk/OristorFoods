"use client";

import { useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { QaSummary } from "@/services/product-detail-extensions";
import { QUESTION_PAGE_SIZE, type QuestionPage, type QuestionPageQuery } from "@/types/question";

import { QaList } from "./qa-list";
import { QaSearch } from "./qa-search";

interface QuestionsSectionProps {
  productSlug: string;
  /** Fetched by the PDP (server) through the Q&A summary provider. */
  summary: QaSummary | null;
}

/**
 * Owns the list state (search text, page). Kept in component state, not the
 * URL, so the PDP URL stays canonical.
 */
export function QuestionsSection({ productSlug, summary }: QuestionsSectionProps) {
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(searchText.trim(), 300);

  const query: QuestionPageQuery = { page, pageSize: QUESTION_PAGE_SIZE, ...(search ? { q: search } : {}) };
  const initialPage: QuestionPage = {
    items: summary?.previewItems ?? [],
    total: summary?.totalCount ?? 0,
    page: 1,
    pageSize: QUESTION_PAGE_SIZE,
  };

  return (
    <section aria-labelledby="questions-heading" className="flex flex-col gap-6">
      <h2 id="questions-heading" className="text-h3 font-heading text-charcoal">
        Questions &amp; Answers
      </h2>
      <QaSearch
        value={searchText}
        onChange={(value) => {
          setSearchText(value);
          setPage(1);
        }}
      />
      <QaList productSlug={productSlug} initialPage={initialPage} query={query} onPageChange={setPage} />
    </section>
  );
}
