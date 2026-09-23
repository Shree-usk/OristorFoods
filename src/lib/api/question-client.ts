import { readApiError, type ApiError } from "@/lib/api/api-error";
import type { OwnQuestion, QuestionPage, QuestionPageQuery } from "@/types/question";
import type { QuestionInput } from "@/validation/question.schema";

/** Browser-side wrapper around the product questions API (STORY-016). */
export type QuestionApiError = ApiError<keyof QuestionInput>;

function questionsUrl(productSlug: string): string {
  return `/api/products/${encodeURIComponent(productSlug)}/questions`;
}

export async function fetchQuestionPage(productSlug: string, query: QuestionPageQuery): Promise<QuestionPage> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.q) params.set("q", query.q);
  const response = await fetch(`${questionsUrl(productSlug)}?${params.toString()}`);
  if (!response.ok) throw await readApiError<keyof QuestionInput>(response);
  return (await response.json()) as QuestionPage;
}

export async function fetchMyQuestions(productSlug: string): Promise<OwnQuestion[]> {
  const response = await fetch(`${questionsUrl(productSlug)}/mine`);
  if (!response.ok) throw await readApiError<keyof QuestionInput>(response);
  return ((await response.json()) as { questions: OwnQuestion[] }).questions;
}

export async function postQuestion(productSlug: string, input: QuestionInput): Promise<OwnQuestion> {
  const response = await fetch(questionsUrl(productSlug), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await readApiError<keyof QuestionInput>(response);
  return ((await response.json()) as { question: OwnQuestion }).question;
}
