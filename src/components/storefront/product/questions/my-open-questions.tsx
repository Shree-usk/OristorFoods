"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { fetchMyQuestions } from "@/lib/api/question-client";
import { formatDisplayDate } from "@/lib/format-date";

/** The signed-in customer's own questions that haven't been published yet. */
export function MyOpenQuestions({ productSlug }: { productSlug: string }) {
  const { status } = useSession();
  const { data } = useQuery({
    queryKey: ["my-questions", productSlug],
    queryFn: () => fetchMyQuestions(productSlug),
    enabled: status === "authenticated",
  });

  if (status !== "authenticated" || !data || data.length === 0) return null;

  return (
    <div className="rounded-lg border border-charcoal/10 p-4">
      <h3 className="text-h4 font-heading text-charcoal">Your questions awaiting an answer</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {data.map((question) => (
          <li key={question.id}>
            <p className="text-small text-charcoal">{question.text}</p>
            <p className="text-caption text-charcoal/70">
              Asked <time dateTime={question.createdAt}>{formatDisplayDate(question.createdAt)}</time>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
