import type { RecipeCard } from "@/types/recipe";

export interface BlogPostCardData {
  id: string;
  slug: string;
  href: string;
  title: string;
  excerpt: string;
  heroImageUrl: string | null;
  authorName: string;
  authorSlug: string;
  publishedAt: string | null;
  readingTimeMinutes: number | null;
  tags: { name: string; slug: string }[];
}

export interface BlogCommentData {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface BlogPostDetailData extends BlogPostCardData {
  bodyContent: string;
  authorBio: string | null;
  authorAvatarUrl: string | null;
  comments: BlogCommentData[];
  relatedPosts: BlogPostCardData[];
  recipeCards: Record<string, RecipeCard>;
  /** STORY-044. Falls back to title/excerpt/heroImageUrl when unset — see generateMetadata in blog/[slug]/page.tsx. */
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
}

export interface BlogListResult {
  posts: BlogPostCardData[];
  total: number;
  page: number;
  pageSize: number;
}
