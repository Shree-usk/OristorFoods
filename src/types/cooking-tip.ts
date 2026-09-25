/** One cooking tip card, used by the /cooking-tips grid and GET /api/cooking-tips. */
export interface CookingTipCard {
  id: string;
  slug: string;
  /** `/cooking-tips/${slug}` (the detail page is STORY-020). */
  href: string;
  title: string;
  summary: string;
  imageUrl: string | null;
  imageAlt: string;
  topicTag: string;
  /** null when the tip has no video. */
  video: { url: string; provider: "Youtube" | "Vimeo" | "SelfHosted" } | null;
  /** Related products. */
  products: { id: string; slug: string; name: string }[];
}

export interface CookingTipDetail {
  id: string;
  slug: string;
  href: string;
  title: string;
  summary: string;
  bodyContent: string;
  imageUrl: string | null;
  imageAlt: string;
  topicTag: string;
  /** null when the tip has no video. */
  video: { url: string; provider: "Youtube" | "Vimeo" | "SelfHosted" } | null;
  /** Related products. */
  products: { id: string; slug: string; name: string }[];
  publishedAt: string | null;
}

export interface CookingTipListResult {
  cookingTips: CookingTipCard[];
  total: number;
  page: number;
  pageSize: number;
}
