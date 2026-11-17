import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ExportProductCard } from "@/components/storefront/export/export-product-card";
import type { ExportCatalogueProduct } from "@/lib/api/export-catalogue-client";
import { useExportCatalogueSelectionStore } from "@/lib/stores/export-catalogue-selection-store";

const baseProduct: ExportCatalogueProduct = {
  id: "1",
  sku: "SKU-1",
  slug: "ceylon-cinnamon",
  name: "Ceylon Cinnamon Sticks",
  shortDescription: "Premium cinnamon.",
  exportDescription: null,
  weightGrams: 500,
  isExportFeatured: false,
  collections: [],
  images: [
    { url: "/images/cinnamon-1.jpg", altText: "Front" },
    { url: "/images/cinnamon-2.jpg", altText: "Back" },
  ],
};

beforeEach(() => {
  localStorage.clear();
  useExportCatalogueSelectionStore.setState({ items: [] });
});

describe("ExportProductCard", () => {
  it("links the image/name area to the product's export detail page", () => {
    render(<ExportProductCard product={baseProduct} />);
    expect(screen.getByRole("link", { name: /Ceylon Cinnamon Sticks/ })).toHaveAttribute("href", "/export/catalogue/ceylon-cinnamon");
  });

  it("shows a dot per image and switches the active image on click without navigating", () => {
    render(<ExportProductCard product={baseProduct} />);
    const dots = screen.getAllByRole("button", { name: /Show image \d of 2/ });
    expect(dots).toHaveLength(2);
    expect(dots[0]).toHaveAttribute("aria-current", "true");

    fireEvent.click(dots[1]);
    expect(dots[1]).toHaveAttribute("aria-current", "true");
    expect(dots[0]).toHaveAttribute("aria-current", "false");
  });

  it("renders no dots for a single-image product", () => {
    render(<ExportProductCard product={{ ...baseProduct, images: [baseProduct.images[0]] }} />);
    expect(screen.queryByRole("button", { name: /Show image/ })).not.toBeInTheDocument();
  });

  it("toggles the shared selection store independently of the detail link", () => {
    render(<ExportProductCard product={baseProduct} />);
    const checkbox = screen.getByRole("checkbox", { name: "Add to selection" });
    fireEvent.click(checkbox);
    expect(useExportCatalogueSelectionStore.getState().has("1")).toBe(true);
  });
});
