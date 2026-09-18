import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductGallery } from "@/components/storefront/product/product-gallery";

const images = [
  { url: "/primary.jpg", altText: "Primary", isPrimary: true },
  { url: "/secondary.jpg", altText: "Secondary", isPrimary: false },
];

describe("ProductGallery", () => {
  it("renders the primary image and one thumbnail per image", () => {
    render(<ProductGallery images={images} productName="Curry Powder" />);

    // The primary image is rendered twice: once as the main display image,
    // once as its own thumbnail.
    expect(screen.getAllByAltText("Primary")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Show image 1 of 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show image 2 of 2" })).toBeInTheDocument();
  });

  it("does not render a thumbnail row for a single image", () => {
    render(<ProductGallery images={[images[0]]} productName="Curry Powder" />);

    expect(screen.queryByRole("button", { name: /Show image/ })).not.toBeInTheDocument();
  });

  it("includes videos in the gallery alongside images", () => {
    render(
      <ProductGallery
        images={[images[0]]}
        videos={[{ url: "/demo.mp4", altText: "Demo video" }]}
        productName="Curry Powder"
      />,
    );

    expect(screen.getByRole("button", { name: "Show video 2 of 2" })).toBeInTheDocument();
  });
});
