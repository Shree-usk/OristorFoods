import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ComponentProps } from "react";

import { ProductGallery } from "@/components/storefront/product/product-gallery";
import { VariantSelectionProvider } from "@/components/storefront/product/variant-selection-context";

const images = [
  { url: "/primary.jpg", altText: "Primary", isPrimary: true },
  { url: "/secondary.jpg", altText: "Secondary", isPrimary: false },
];

// ProductGallery reads the selected variant from VariantSelectionProvider
// (shared with its sibling ProductPurchasePanel on the real PDP) rather than
// a prop, so every render needs a provider ancestor even when this test
// doesn't care about variants at all.
function renderGallery(props: ComponentProps<typeof ProductGallery>) {
  return render(
    <VariantSelectionProvider variants={props.variants ?? []}>
      <ProductGallery {...props} />
    </VariantSelectionProvider>,
  );
}

describe("ProductGallery", () => {
  it("renders the primary image and one thumbnail per image", () => {
    renderGallery({ images, productName: "Curry Powder" });

    // The primary image is rendered twice: once as the main display image,
    // once as its own thumbnail.
    expect(screen.getAllByAltText("Primary")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Show image 1 of 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show image 2 of 2" })).toBeInTheDocument();
  });

  it("does not render a thumbnail row for a single image", () => {
    renderGallery({ images: [images[0]], productName: "Curry Powder" });

    expect(screen.queryByRole("button", { name: /Show image/ })).not.toBeInTheDocument();
  });

  it("includes videos in the gallery alongside images", () => {
    renderGallery({
      images: [images[0]],
      videos: [{ url: "/demo.mp4", altText: "Demo video" }],
      productName: "Curry Powder",
    });

    expect(screen.getByRole("button", { name: "Show video 2 of 2" })).toBeInTheDocument();
  });

  it("shows the selected variant's own images instead of the product's", () => {
    const variants = [
      {
        id: "v1",
        sku: "SKU-1",
        name: "200g",
        netWeightGrams: 200,
        price: 100,
        promoPrice: null,
        currency: "LKR",
        inStock: true,
        stockQuantity: 5,
        images: [{ url: "/variant.jpg", altText: "Variant photo" }],
      },
    ];
    render(
      <VariantSelectionProvider variants={variants}>
        <ProductGallery images={images} variants={variants} productName="Curry Powder" />
      </VariantSelectionProvider>,
    );

    expect(screen.getByAltText("Variant photo")).toBeInTheDocument();
    expect(screen.queryByAltText("Primary")).not.toBeInTheDocument();
  });

  it("shows a graceful placeholder instead of a broken image when there are no images or video", () => {
    renderGallery({ images: [], productName: "Curry Powder" });

    expect(screen.getByText("No image available")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /no image available/i })).toBeDisabled();
  });
});
