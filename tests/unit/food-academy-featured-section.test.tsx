import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FoodAcademyFeaturedSection } from "@/components/storefront/food-academy/food-academy-featured-section";
import type { FoodAcademyEntryCard } from "@/types/food-academy";

const ENTRIES: FoodAcademyEntryCard[] = [
  {
    id: "1",
    slug: "entry-1",
    href: "/food-academy/entry-1",
    title: "Entry One",
    summary: "Summary one.",
    heroImageUrl: null,
    contentType: "Article",
    categoryName: "Ingredients",
    categorySlug: "ingredients",
    readingTimeMinutes: 4,
    isFeatured: true,
  },
];

describe("FoodAcademyFeaturedSection", () => {
  it("renders the heading, description and a 'View all' link to the hub", () => {
    render(<FoodAcademyFeaturedSection heading="Learn something delicious" description="Explore the knowledge." entries={ENTRIES} />);
    expect(screen.getByRole("heading", { name: "Learn something delicious" })).toBeInTheDocument();
    expect(screen.getByText("Explore the knowledge.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View all/ })).toHaveAttribute("href", "/food-academy");
    expect(screen.getByRole("link", { name: /Entry One/ })).toHaveAttribute("href", "/food-academy/entry-1");
  });

  it("renders nothing when there are no featured entries", () => {
    const { container } = render(<FoodAcademyFeaturedSection heading="Learn something delicious" description="" entries={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
