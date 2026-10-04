/**
 * STORY-074. Prop shapes for the About page's components — content now
 * comes from the admin-editable `StoryPageBlock` table (via
 * story-page.service.ts) rather than the deleted src/lib/story-content.ts.
 */

export interface StoryImage {
  src: string;
  alt: string;
}

export interface StoryHeroContent {
  eyebrow: string;
  headline: string;
  subcopy: string;
  image: StoryImage;
}

export interface StoryChapterContent {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  image: StoryImage;
  align: "Left" | "Right";
}

export interface IngredientContent {
  name: string;
  tagline: string;
  image: StoryImage;
}

export interface ProductCategoryContent {
  id: string;
  name: string;
  tagline: string;
  image: StoryImage;
}

export interface OristorValue {
  letter: string;
  word: string;
  description: string;
}

export interface GlobalJourneyContent {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface StoryCtaContent {
  headline: string;
  subcopy: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
}
