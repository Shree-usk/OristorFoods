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
  /** Admin-entered Category.description — optional since the fixture fallback and some real categories leave it unset. */
  description?: string | null;
}

export interface ProductCardData {
  id: string;
  name: string;
  href: string;
  /** Null when the product has no image — render a placeholder, never an empty src. */
  imageSrc: ImageSource | null;
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
 * Shared shape for the marketing "teaser" sections that still use the
 * plain image+text layout (Food Academy, Rewards Club) — structurally
 * identical (headline, description, CTA, image), so one type/component
 * pattern covers both instead of two near-duplicate ones. Export Solutions
 * moved to the richer, admin-controllable ExportHeroData shape below.
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

/**
 * Homepage "Export Solutions" hero — admin-controllable via
 * ExportHeroSetting (a global singleton, same convention as CompanySetting
 * /ExportCatalogueSetting). `headline` may contain one `**highlighted**`
 * span, parsed at render time by parseHighlightedHeadline — never rich
 * text. `badge` and `statLine` are optional: the component omits them
 * entirely rather than rendering an empty card/row when unset.
 */
export interface ExportHeroData {
  backgroundImageUrl: string | null;
  backgroundImageAlt: string | null;
  eyebrow: string | null;
  headline: string | null;
  description: string | null;
  primaryCtaLabel: string | null;
  primaryCtaHref: string | null;
  secondaryCtaLabel: string | null;
  secondaryCtaHref: string | null;
  statLine: { label: string; description: string }[] | null;
  badge: { eyebrow: string; headline: string; description: string; ctaLabel: string; ctaHref: string } | null;
}
