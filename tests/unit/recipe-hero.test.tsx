import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecipeHero } from "@/components/storefront/recipes/recipe-hero";

describe("RecipeHero", () => {
  it("renders the static hero image when there is no video", () => {
    render(<RecipeHero heroImage="/hero.jpg" heroImageAlt="Dhal Curry" galleryImageUrls={[]} video={null} />);
    expect(screen.getByAltText("Dhal Curry")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /play video/i })).not.toBeInTheDocument();
  });

  it("renders VideoPlayer's play button when a video is present", () => {
    render(
      <RecipeHero
        heroImage="/hero.jpg"
        heroImageAlt="Dhal Curry"
        galleryImageUrls={[]}
        video={{ url: "https://youtu.be/abc123", provider: "Youtube" }}
      />,
    );
    expect(screen.getByRole("button", { name: /play video/i })).toBeInTheDocument();
  });
});
