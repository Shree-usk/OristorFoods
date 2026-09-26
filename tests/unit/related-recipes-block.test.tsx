import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RelatedRecipesBlock } from "@/components/storefront/food-academy/related-recipes-block";

describe("RelatedRecipesBlock", () => {
  it("renders a heading and a link per recipe", () => {
    render(
      <RelatedRecipesBlock
        recipes={[
          { id: "1", title: "Chicken Curry", slug: "chicken-curry", imageSrc: "/curry.webp" },
          { id: "2", title: "Dhal", slug: "dhal", imageSrc: "/dhal.webp" },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: /recipes to try/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /chicken curry/i })).toHaveAttribute("href", "/recipes/chicken-curry");
    expect(screen.getByRole("link", { name: /dhal/i })).toHaveAttribute("href", "/recipes/dhal");
  });

  it("renders nothing when there are no related recipes", () => {
    const { container } = render(<RelatedRecipesBlock recipes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
