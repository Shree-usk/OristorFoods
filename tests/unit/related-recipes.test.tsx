import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RelatedRecipes } from "@/components/storefront/recipes/related-recipes";

describe("RelatedRecipes", () => {
  it("renders nothing when there are no related recipes", () => {
    const { container } = render(<RelatedRecipes recipes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a RecipeCard per related recipe", () => {
    render(
      <RelatedRecipes
        recipes={[
          { id: "r1", slug: "r1", href: "/recipes/r1", title: "R1", heroImage: "/a.webp", heroImageAlt: "a", categoryName: "Curries", cuisine: null, difficulty: "Easy", totalTimeMinutes: 30, avgRating: null, ratingCount: 0, dietaryTags: [], hasVideo: false },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "R1" })).toBeInTheDocument();
  });
});
