import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FoodAcademyCategoryTiles } from "@/components/storefront/food-academy/food-academy-category-tiles";
import type { FoodAcademyCategoryTile } from "@/types/food-academy";

const CATEGORIES: FoodAcademyCategoryTile[] = [
  { id: "1", name: "Ingredient School", slug: "ingredient-school", description: "Spices and more.", tileImageUrl: "/img.webp", tileImageAlt: "Spices" },
  { id: "2", name: "Cooking Know-How", slug: "cooking-know-how", description: null, tileImageUrl: null, tileImageAlt: null },
];

describe("FoodAcademyCategoryTiles", () => {
  it("renders one tile per category, linking to the hub's category filter", () => {
    render(<FoodAcademyCategoryTiles heading="Explore the world of flavour" description="Practical food knowledge." categories={CATEGORIES} />);

    expect(screen.getByRole("heading", { name: "Explore the world of flavour" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ingredient School/ })).toHaveAttribute("href", "/food-academy?category=ingredient-school");
    expect(screen.getByRole("link", { name: /Cooking Know-How/ })).toHaveAttribute("href", "/food-academy?category=cooking-know-how");
  });

  it("numbers tiles starting at 01", () => {
    render(<FoodAcademyCategoryTiles heading="Explore" description="" categories={CATEGORIES} />);
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
  });

  it("renders nothing when there are no categories", () => {
    const { container } = render(<FoodAcademyCategoryTiles heading="Explore" description="" categories={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
