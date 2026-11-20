// tests/unit/perfect-match-section.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PerfectMatchSection } from "@/components/storefront/home/perfect-match-section";
import type { PerfectMatchProductData } from "@/types/home";

function makeProduct(overrides: Partial<PerfectMatchProductData> = {}): PerfectMatchProductData {
  // tabLabel defaults to whatever `name` ends up being (mirroring the real
  // "falls back to the full product name when unset" service behavior),
  // so tests that only override `name` don't also need to repeat it as
  // `tabLabel` — pass `tabLabel` explicitly to test the two diverging.
  const name = overrides.name ?? "Oristor Premium Raw Mango Pickle";
  return {
    id: "link-1",
    productId: "product-1",
    name,
    tabLabel: name,
    href: "/products/oristor-premium-raw-mango-pickle",
    kicker: "A taste of heritage",
    description: "A bold, tangy favourite that brings a lively spark to the table.",
    imageSrc: "/images/products/misc/Mango-Pickle-Large.webp",
    imageAlt: "Oristor Premium Raw Mango Pickle",
    pairings: [],
    ...overrides,
  };
}

function makePairing(id: string, title: string) {
  return {
    id,
    title,
    description: `${title} description.`,
    imageSrc: "/images/pairing.webp",
    imageAlt: title,
    categoryLabel: "THE CLASSIC",
    supportingTag: "A comforting favourite",
  };
}

describe("PerfectMatchSection", () => {
  it("renders one tab per product, the first selected initially, and switches on click", () => {
    const products = [
      makeProduct({ id: "link-1", name: "Mango Pickle" }),
      makeProduct({ id: "link-2", name: "Seeni Sambol", description: "Golden onion richness.", imageSrc: null }),
    ];
    render(<PerfectMatchSection products={products} />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("heading", { name: "Mango Pickle" })).toBeInTheDocument();

    fireEvent.click(tabs[1]);
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Seeni Sambol" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Mango Pickle" })).not.toBeInTheDocument();
  });

  it("moves selection with ArrowRight/ArrowLeft and wraps at the ends", () => {
    const products = [makeProduct({ id: "link-1", name: "First" }), makeProduct({ id: "link-2", name: "Second" }), makeProduct({ id: "link-3", name: "Third" })];
    render(<PerfectMatchSection products={products} />);

    const tabs = screen.getAllByRole("tab");
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tabs[1], { key: "ArrowLeft" });
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
    expect(tabs[2]).toHaveAttribute("aria-selected", "true");
  });

  it("renders an ImagePlaceholder instead of a broken image when the product has no primary image", () => {
    render(<PerfectMatchSection products={[makeProduct({ imageSrc: null })]} />);
    expect(screen.getByText("No image available")).toBeInTheDocument();
  });

  it("omits the pairings grid entirely when the active product has no pairings, and shows it when it does", () => {
    const { rerender } = render(<PerfectMatchSection products={[makeProduct({ name: "Mango Pickle" })]} />);
    expect(screen.queryByText(/four ways/)).not.toBeInTheDocument();

    rerender(<PerfectMatchSection products={[makeProduct({ name: "Mango Pickle", pairings: [makePairing("p1", "Rice & Curry")] })]} />);
    expect(screen.getByText("Mango Pickle, four ways")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rice & Curry" })).toBeInTheDocument();
  });

  it("shows the short tabLabel on the tab, not the full product name, when they differ", () => {
    render(<PerfectMatchSection products={[makeProduct({ name: "Oristor Premium Raw Mango Pickle", tabLabel: "Mango Pickle" })]} />);
    expect(screen.getByRole("tab", { name: "Mango Pickle" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Oristor Premium Raw Mango Pickle" })).not.toBeInTheDocument();
    // The full name still appears in the featured panel's own heading.
    expect(screen.getByRole("heading", { name: "Oristor Premium Raw Mango Pickle" })).toBeInTheDocument();
  });

  it("links the 'Explore this product' button to the product's real href", () => {
    render(<PerfectMatchSection products={[makeProduct({ href: "/products/oristor-premium-raw-mango-pickle" })]} />);
    // Base UI's Button-as-link renders role="button" on the anchor, not role="link".
    expect(screen.getByRole("button", { name: /Explore this product/ })).toHaveAttribute("href", "/products/oristor-premium-raw-mango-pickle");
  });
});
