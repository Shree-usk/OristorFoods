import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecipeCard } from "@/components/storefront/recipes/recipe-card";
import { RecipeGrid } from "@/components/storefront/recipes/recipe-grid";
import type { RecipeCard as RecipeCardData } from "@/types/recipe";

const recipe: RecipeCardData = {
  id: "r1",
  slug: "sri-lankan-chicken-curry",
  href: "/recipes/sri-lankan-chicken-curry",
  title: "Sri Lankan Chicken Curry",
  heroImage: "/images/products/export/chicken-masala.png",
  heroImageAlt: "Oristor chicken masala, used in this recipe",
  categoryName: "Curries",
  cuisine: "Sri Lankan",
  difficulty: "Medium",
  totalTimeMinutes: 90,
  avgRating: 4.9,
  ratingCount: 58,
  dietaryTags: ["Gluten-Free", "Spicy"],
  hasVideo: false,
};

describe("RecipeCard", () => {
  it("links the title to the recipe detail page", () => {
    render(<RecipeCard recipe={recipe} />);

    expect(screen.getByRole("link", { name: "Sri Lankan Chicken Curry" })).toHaveAttribute(
      "href",
      "/recipes/sri-lankan-chicken-curry",
    );
    expect(screen.getByRole("heading", { level: 3, name: "Sri Lankan Chicken Curry" })).toBeInTheDocument();
  });

  it("shows the hero image with its alt text, category, cuisine, time and difficulty", () => {
    render(<RecipeCard recipe={recipe} />);

    expect(screen.getByAltText("Oristor chicken masala, used in this recipe")).toBeInTheDocument();
    expect(screen.getByText("Curries")).toBeInTheDocument();
    expect(screen.getByText("Sri Lankan")).toBeInTheDocument();
    expect(screen.getByText("1 hr 30 min")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
  });

  it("shows an accessible rating when the recipe has ratings", () => {
    render(<RecipeCard recipe={recipe} />);
    expect(screen.getByRole("img", { name: "Rated 4.9 out of 5 from 58 ratings" })).toBeInTheDocument();
  });

  it("hides the rating when there are no ratings yet", () => {
    render(<RecipeCard recipe={{ ...recipe, avgRating: null, ratingCount: 0 }} />);
    expect(screen.queryByRole("img", { name: /Rated/ })).not.toBeInTheDocument();
  });

  it("uses singular wording for one rating and supports an h2 heading", () => {
    render(<RecipeCard recipe={{ ...recipe, avgRating: 5, ratingCount: 1 }} headingLevel="h2" />);

    expect(screen.getByRole("img", { name: "Rated 5.0 out of 5 from 1 rating" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });
});

describe("RecipeGrid", () => {
  it("renders one list item per recipe", () => {
    render(<RecipeGrid recipes={[recipe, { ...recipe, id: "r2", title: "Dhal Curry" }]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
