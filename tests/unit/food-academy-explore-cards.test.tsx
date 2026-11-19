import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FoodAcademyExploreCards } from "@/components/storefront/home/food-academy-explore-cards";
import type { FoodAcademyCategoryTile } from "@/types/food-academy";

const CATEGORIES: FoodAcademyCategoryTile[] = [
  { id: "1", name: "Ingredients", slug: "ingredients", description: "Spices, chillies and seafood.", tileImageUrl: null, tileImageAlt: null },
  { id: "2", name: "Techniques", slug: "techniques", description: "Tempering and roasting.", tileImageUrl: null, tileImageAlt: null },
  { id: "3", name: "Heritage", slug: "heritage", description: null, tileImageUrl: null, tileImageAlt: null },
  { id: "4", name: "Fourth", slug: "fourth", description: null, tileImageUrl: null, tileImageAlt: null },
];

describe("FoodAcademyExploreCards", () => {
  it("renders the admin-provided heading/description and up to 3 category cards linking to the hub's filter", () => {
    render(<FoodAcademyExploreCards heading="Explore the world of flavour" description="Practical food knowledge." categories={CATEGORIES} />);

    expect(screen.getByRole("heading", { name: "Explore the world of flavour" })).toBeInTheDocument();
    expect(screen.getByText("Practical food knowledge.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ingredients/ })).toHaveAttribute("href", "/food-academy?category=ingredients");
    expect(screen.getByRole("link", { name: /Techniques/ })).toHaveAttribute("href", "/food-academy?category=techniques");
    expect(screen.getByRole("link", { name: /Heritage/ })).toHaveAttribute("href", "/food-academy?category=heritage");
    expect(screen.queryByRole("link", { name: /Fourth/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Visit the Food Academy/ })).toHaveAttribute("href", "/food-academy");
  });

  it("numbers cards starting at 01, paired with the category name", () => {
    render(<FoodAcademyExploreCards heading="Explore" description="" categories={CATEGORIES} />);
    expect(screen.getByText("01 / INGREDIENTS")).toBeInTheDocument();
    expect(screen.getByText("02 / TECHNIQUES")).toBeInTheDocument();
    expect(screen.getByText("03 / HERITAGE")).toBeInTheDocument();
  });

  it("renders nothing when there are no categories", () => {
    const { container } = render(<FoodAcademyExploreCards heading="Explore" description="" categories={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
