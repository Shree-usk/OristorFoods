// tests/unit/featured-categories.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FeaturedCategories } from "@/components/storefront/home/featured-categories";
import type { CategoryCardData } from "@/types/home";

function makeCategory(overrides: Partial<CategoryCardData> = {}): CategoryCardData {
  return {
    id: "cat-1",
    name: "Chili Pastes & Sambols",
    href: "/products/category/chili-pastes",
    imageSrc: "/images/products/misc/Chili-Paste-Large.webp",
    imageAlt: "Jar of Oristor stemless chili paste",
    ...overrides,
  };
}

describe("FeaturedCategories", () => {
  it("renders the section title, defaulting when no override is set", () => {
    render(<FeaturedCategories categories={[makeCategory()]} />);
    expect(screen.getByRole("heading", { name: "Shop by Category" })).toBeInTheDocument();
  });

  it("honours a titleOverride", () => {
    render(<FeaturedCategories categories={[makeCategory()]} titleOverride="Browse Our Range" />);
    expect(screen.getByRole("heading", { name: "Browse Our Range" })).toBeInTheDocument();
  });

  it("renders every category's name, image, and a link to its own category page", () => {
    const categories = [makeCategory({ id: "a", name: "Pickles", href: "/products/category/pickles" }), makeCategory({ id: "b", name: "Masala Blends", href: "/products/category/masala" })];
    render(<FeaturedCategories categories={categories} />);

    expect(screen.getByText("Pickles")).toBeInTheDocument();
    expect(screen.getByText("Masala Blends")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pickles/ })).toHaveAttribute("href", "/products/category/pickles");
    expect(screen.getByRole("link", { name: /Masala Blends/ })).toHaveAttribute("href", "/products/category/masala");
  });

  it("shows the category's description when set, and omits it when absent", () => {
    const categories = [makeCategory({ id: "with-desc", name: "With Description", description: "Savoury accompaniments for everyday meals." }), makeCategory({ id: "no-desc", name: "No Description", description: null })];
    render(<FeaturedCategories categories={categories} />);

    expect(screen.getByText("Savoury accompaniments for everyday meals.")).toBeInTheDocument();
    expect(screen.getByText("No Description")).toBeInTheDocument();
  });

  it("renders nothing for an empty category list beyond the heading", () => {
    render(<FeaturedCategories categories={[]} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
