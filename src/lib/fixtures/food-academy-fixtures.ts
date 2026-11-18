import type { FoodAcademyPageSettingData } from "@/types/food-academy";

/**
 * Never-blank fallback for any FoodAcademyPageSetting field an admin hasn't
 * set yet — same per-field "?? default" idiom as home-fixtures.ts's
 * exportHeroDefaults, applied to the /food-academy page instead of a
 * homepage section. Copy sourced from the approved "Project Cinnamon"
 * design brief.
 */
export const foodAcademyPageDefaults: Omit<FoodAcademyPageSettingData, "enabled" | "heroImageUrl" | "seoOgImageUrl"> = {
  heroEyebrow: "The Oristor Food Academy",
  heroHeading: "Know your ingredients. Discover your flavour.",
  heroDescription:
    "Go beyond recipes. Explore the spices, ingredients and time-honoured techniques that make Sri Lankan cooking truly special.",
  heroPrimaryCtaLabel: "Explore Food Academy",
  heroPrimaryCtaHref: "/food-academy",
  heroSecondaryCtaLabel: "Discover what you'll learn",
  heroSecondaryCtaHref: "/food-academy",
  heroImageAlt: "Oristor product",
  heroBadgeText: "A little knowledge. A lot of flavour.",
  exploreHeading: "Explore the world of flavour",
  exploreDescription: "Practical food knowledge, rooted in Sri Lankan tradition.",
  featuredHeading: "Learn something delicious",
  featuredDescription: "Explore the knowledge, techniques and traditions behind the flavours you love.",
  instagramEnabled: true,
  instagramHeading: "A Taste of ORISTOR on Instagram",
  instagramDescription: "Discover our latest flavours, kitchen moments and culinary inspiration.",
  instagramCtaLabel: "Follow @ORISTOR on Instagram",
  instagramCtaHref: "https://instagram.com/oristorfoods",
  seoTitle: "Food Academy | Oristor",
  seoMetaDescription:
    "Explore the spices, ingredients and time-honoured techniques behind authentic Sri Lankan cooking with the Oristor Food Academy.",
  seoCanonicalPath: "/food-academy",
};
