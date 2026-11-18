import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FoodAcademyHero } from "@/components/storefront/food-academy/food-academy-hero";
import type { FoodAcademyPageSettingData } from "@/types/food-academy";

const BASE_DATA: FoodAcademyPageSettingData = {
  enabled: true,
  heroEyebrow: "The Oristor Food Academy",
  heroHeading: "Know your ingredients. Discover your flavour.",
  heroDescription: "Go beyond recipes.",
  heroPrimaryCtaLabel: "Explore Food Academy",
  heroPrimaryCtaHref: "/food-academy",
  heroSecondaryCtaLabel: "Discover what you'll learn",
  heroSecondaryCtaHref: "/food-academy",
  heroImageUrl: "/images/hero.webp",
  heroImageAlt: "Oristor product",
  heroBadgeText: "A little knowledge. A lot of flavour.",
  exploreHeading: "Explore the world of flavour",
  exploreDescription: "Practical food knowledge.",
  featuredHeading: "Learn something delicious",
  featuredDescription: "Explore the knowledge behind the flavours you love.",
  instagramEnabled: true,
  instagramHeading: "Instagram",
  instagramDescription: "Follow along.",
  instagramCtaLabel: "Follow",
  instagramCtaHref: "https://instagram.com/oristorfoods",
  seoTitle: "Food Academy | Oristor",
  seoMetaDescription: "Learn Sri Lankan cooking.",
  seoCanonicalPath: "/food-academy",
  seoOgImageUrl: null,
};

describe("FoodAcademyHero", () => {
  it("renders the heading as an h1 and both CTAs", () => {
    render(<FoodAcademyHero data={BASE_DATA} />);
    expect(screen.getByRole("heading", { level: 1, name: BASE_DATA.heroHeading })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(BASE_DATA.heroPrimaryCtaLabel) })).toHaveAttribute("href", "/food-academy");
    expect(screen.getByRole("link", { name: BASE_DATA.heroSecondaryCtaLabel! })).toHaveAttribute("href", "/food-academy");
  });

  it("renders the badge text when set", () => {
    render(<FoodAcademyHero data={BASE_DATA} />);
    expect(screen.getByText(BASE_DATA.heroBadgeText!)).toBeInTheDocument();
  });

  it("omits the secondary CTA and badge when unset", () => {
    render(<FoodAcademyHero data={{ ...BASE_DATA, heroSecondaryCtaLabel: "", heroSecondaryCtaHref: "", heroBadgeText: "" }} />);
    expect(screen.queryByText(BASE_DATA.heroSecondaryCtaLabel!)).not.toBeInTheDocument();
    expect(screen.queryByText(BASE_DATA.heroBadgeText!)).not.toBeInTheDocument();
  });
});
