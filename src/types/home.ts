import type { LucideIcon } from "lucide-react";
import type { StaticImageData } from "next/image";

/**
 * Data shapes for every homepage section (STORY-006). All image fields
 * accept either a static import (`StaticImageData`, used by the fixture
 * data in `src/lib/fixtures/home-fixtures.ts`) or a plain URL string, so
 * a later API-backed implementation (Product Platform, Recipes, etc.)
 * can supply a CDN URL without changing these types.
 *
 * These shapes are the contract: when STORY-009/010 (Product Catalogue),
 * STORY-017 (Recipes), STORY-015 (Reviews), STORY-020 (Food Academy),
 * STORY-030 (Rewards), or STORY-058 (Export) land, swap the fixture data
 * source for a real query — the section components' props don't need to
 * change as long as the real data satisfies these interfaces.
 */

export type ImageSource = StaticImageData | string;

export interface HeroBannerData {
  headline: string;
  subheadline: string;
  ctaLabel: string;
  ctaHref: string;
  imageSrc: ImageSource;
  imageAlt: string;
}

export interface CategoryCardData {
  id: string;
  name: string;
  href: string;
  imageSrc: ImageSource;
  imageAlt: string;
}

export interface ProductCardData {
  id: string;
  name: string;
  href: string;
  imageSrc: ImageSource;
  imageAlt: string;
  /** Smallest-unit-free decimal amount, e.g. 1250 for "Rs. 1,250.00". */
  price: number;
  currency: string;
  rating?: number;
  reviewCount?: number;
  badge?: string;
}

export interface CollectionCardData {
  id: string;
  name: string;
  href: string;
  imageSrc: ImageSource;
  imageAlt: string;
  description: string;
}

export interface ReviewData {
  id: string;
  authorName: string;
  authorLocation?: string;
  rating: number;
  quote: string;
}

export interface InstagramPostData {
  id: string;
  imageSrc: ImageSource;
  imageAlt: string;
  href: string;
}

export interface WhyChooseFeatureData {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

/**
 * Shared shape for the three marketing "teaser" sections (Food Academy,
 * Export Solutions, Rewards Club) — structurally identical (headline,
 * description, CTA, image), so one type/component pattern covers all
 * three instead of three near-duplicate ones.
 */
export interface TeaserSectionData {
  eyebrow: string;
  headline: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  imageSrc: ImageSource;
  imageAlt: string;
}
