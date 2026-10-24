import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VariantSelector } from "@/components/storefront/product/variant-selector";
import type { ProductDetailVariant } from "@/services/product.service";

function makeVariant(overrides: Partial<ProductDetailVariant> = {}): ProductDetailVariant {
  return {
    id: "v1",
    sku: "SKU-1",
    name: "200g",
    netWeightGrams: 200,
    price: 450,
    promoPrice: null,
    currency: "LKR",
    inStock: true,
    stockQuantity: 10,
    images: [],
    ...overrides,
  };
}

describe("VariantSelector", () => {
  it("renders nothing for a plain, variant-less product", () => {
    const { container } = render(<VariantSelector variants={[]} selectedVariantId={null} onSelect={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows each variant's own thumbnail when it has an image", () => {
    const variants = [makeVariant({ id: "v1", name: "200g", images: [{ url: "/200g.jpg", altText: "200g jar" }] })];
    render(<VariantSelector variants={variants} selectedVariantId={null} onSelect={vi.fn()} />);

    expect(screen.getByRole("button", { name: /200g/ })).toBeInTheDocument();
    expect(screen.getByAltText("")).toHaveAttribute("src", expect.stringContaining("200g.jpg"));
  });

  it("falls back to a placeholder, not a broken image, when a variant has no image", () => {
    const variants = [makeVariant({ id: "v1", name: "350g", images: [] })];
    render(<VariantSelector variants={variants} selectedVariantId={null} onSelect={vi.fn()} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("marks an out-of-stock variant unavailable and disabled", () => {
    const variants = [makeVariant({ id: "v1", name: "500g", inStock: false, stockQuantity: 0 })];
    render(<VariantSelector variants={variants} selectedVariantId={null} onSelect={vi.fn()} />);

    const button = screen.getByRole("button", { name: /500g/ });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("(unavailable)");
  });
});
