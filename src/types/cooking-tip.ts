export interface CookingTipCard {
  id: string;
  slug: string;
  href: string;
  title: string;
  summary: string;
  imageUrl: string | null;
  hasVideo: boolean;
  topicTag: string;
}

export interface CookingTipDetail extends CookingTipCard {
  bodyContent: string;
  video: { url: string; provider: "Youtube" | "Vimeo" | "SelfHosted" } | null;
  relatedTips: CookingTipCard[];
  products: { id: string; slug: string; name: string }[];
}

export interface CookingTipListResult {
  tips: CookingTipCard[];
  total: number;
  page: number;
  pageSize: number;
}
