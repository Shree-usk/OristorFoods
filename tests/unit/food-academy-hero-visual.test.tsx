import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FoodAcademyHeroVisual } from "@/components/storefront/food-academy/food-academy-hero-visual";

describe("FoodAcademyHeroVisual", () => {
  it("renders the hero image and badge when both are set", () => {
    render(<FoodAcademyHeroVisual imageUrl="/images/hero.webp" imageAlt="Oristor turmeric powder" badgeText="A little knowledge." />);
    expect(screen.getByAltText("Oristor turmeric powder")).toBeInTheDocument();
    expect(screen.getByText("A little knowledge.")).toBeInTheDocument();
  });

  it("omits the badge when badgeText is unset", () => {
    render(<FoodAcademyHeroVisual imageUrl="/images/hero.webp" imageAlt="Oristor product" badgeText={null} />);
    expect(screen.getByAltText("Oristor product")).toBeInTheDocument();
    expect(screen.queryByText("A little knowledge.")).not.toBeInTheDocument();
  });

  it("renders nothing when there is no image", () => {
    const { container } = render(<FoodAcademyHeroVisual imageUrl={null} imageAlt={null} badgeText="A little knowledge." />);
    expect(container).toBeEmptyDOMElement();
  });
});
