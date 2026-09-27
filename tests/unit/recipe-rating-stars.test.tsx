// tests/unit/recipe-rating-stars.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecipeRatingStars } from "@/components/storefront/recipes/recipe-rating-stars";

describe("RecipeRatingStars", () => {
  it("renders \"No reviews yet.\" for a recipe with no Approved reviews, never \"0.0 stars\"", () => {
    render(<RecipeRatingStars avgRating={null} ratingCount={0} />);

    expect(screen.getByText("No reviews yet.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders the star summary with a computed aria-label for a rated recipe", () => {
    render(<RecipeRatingStars avgRating={4.5} ratingCount={2} />);

    expect(screen.getByRole("img", { name: "Rated 4.5 out of 5 from 2 ratings" })).toBeInTheDocument();
    expect(screen.getByText("4.5 (2)")).toBeInTheDocument();
  });

  it("uses singular \"rating\" for a count of exactly 1", () => {
    render(<RecipeRatingStars avgRating={5} ratingCount={1} />);

    expect(screen.getByRole("img", { name: "Rated 5.0 out of 5 from 1 rating" })).toBeInTheDocument();
  });
});
