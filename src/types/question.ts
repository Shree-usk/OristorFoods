/**
 * Product Q&A types and constants shared by server and client code
 * (STORY-016). Keep this file free of server-only imports: client components
 * import from it.
 */

export type QuestionStatusValue = "Pending" | "Answered" | "Approved" | "Published" | "Rejected";

/** A Published question with its answer, as returned by the public API. */
export interface PublicQuestion {
  id: string;
  question: string;
  answer: string;
  /** ISO 8601 string. */
  publishedAt: string;
}

export interface QuestionPage {
  items: PublicQuestion[];
  total: number;
  page: number;
  pageSize: number;
}

/** The signed-in customer's own question. */
export interface OwnQuestion {
  id: string;
  text: string;
  status: QuestionStatusValue;
  /** ISO 8601 string. */
  createdAt: string;
}

export const QUESTION_PAGE_SIZE = 10;

export interface QuestionPageQuery {
  page: number;
  pageSize: number;
  q?: string;
}
