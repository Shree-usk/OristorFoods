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

  it("renders each recipe's image", () => {
    // alt="" is intentional (decorative — the recipe title is the adjacent
    // caption), which takes the <img> out of the accessibility tree's "img"
    // role — query the raw DOM instead of screen.getByRole.
    const { container } = render(<RelatedRecipesBlock recipes={[{ id: "1", title: "Chicken Curry", slug: "chicken-curry", imageSrc: "/curry.webp" }]} />);
    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    expect(image).toHaveAttribute("src", expect.stringContaining(encodeURIComponent("/curry.webp")));
  });

  it("uses a custom heading and empty-state message when provided — the PDP's own usage", () => {
    render(<RelatedRecipesBlock recipes={[]} heading="Recipes Using This Product" emptyMessage="Recipes for this product are coming soon." />);
    expect(screen.getByRole("heading", { name: "Recipes Using This Product" })).toBeInTheDocument();
    expect(screen.getByText("Recipes for this product are coming soon.")).toBeInTheDocument();
  });
});
