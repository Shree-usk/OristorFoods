import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductStoryScroll } from "@/components/storefront/story/product-story-scroll";
import type { ProductCategoryContent } from "@/types/story";

/**
 * STORY-073/074. Mirrors scroll-reveal.test.tsx/compare-view.test.tsx's
 * mockMatchMedia pattern, extended to differentiate between the two
 * media queries this component reads (`prefers-reduced-motion` and
 * `min-width: 1024px`) rather than applying one boolean to both, since
 * their combination is exactly what decides which variant renders.
 *
 * Categories are now a prop (sourced from StoryPageBlock, STORY-074),
 * not a direct import from the deleted src/lib/story-content.ts — this
 * fixture mirrors the same 6 real category names/images the seed writes.
 */
function mockMatchMedia({ reducedMotion, desktop }: { reducedMotion: boolean; desktop: boolean }) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? reducedMotion : query.includes("min-width") ? desktop : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

const categories: ProductCategoryContent[] = [
  { id: "pickles", name: "Pickles", tagline: "Mango, tempered with mustard and chilli.", image: { src: "/images/products/best-sellers/Mango-Pickle-Large.webp", alt: "Real Oristor mango pickle" } },
  { id: "pickled-vegetables", name: "Pickled Vegetables", tagline: "Jackfruit, banana blossom, lotus — preserved the traditional way.", image: { src: "/images/products/export/oristor-brine-in-Jackfruit-1.webp", alt: "Real Oristor jackfruit in brine" } },
  { id: "chilli-pastes", name: "Chilli Pastes", tagline: "Built for heat, built for flavour.", image: { src: "/images/products/best-sellers/Chili-Paste-Large.png", alt: "Real Oristor chilli paste" } },
  { id: "seafood", name: "Seafood", tagline: "Dried, salted, sun-true to the coast.", image: { src: "/images/products/best-sellers/Sprats-Large.webp", alt: "Real Oristor dried sprats" } },
  { id: "masalas", name: "Masalas", tagline: "Blended for chicken, fish, and everything between.", image: { src: "/images/products/export/chicken-masala.png", alt: "Real Oristor chicken masala" } },
  { id: "spices", name: "Spices", tagline: "The foundation of every Oristor kitchen.", image: { src: "/images/products/export/curry-powder.webp", alt: "Real Oristor curry powder" } },
];

describe("ProductStoryScroll", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the pinned desktop variant at desktop width with no reduced-motion preference", () => {
    mockMatchMedia({ reducedMotion: false, desktop: true });
    const { container } = render(<ProductStoryScroll categories={categories} />);

    // The pinned variant's tall scroll-length wrapper has an explicit inline height.
    expect(container.querySelector('[style*="height"]')).not.toBeNull();
  });

  it("renders the vertical fallback stack at mobile width", () => {
    mockMatchMedia({ reducedMotion: false, desktop: false });
    render(<ProductStoryScroll categories={categories} />);

    for (const category of categories) {
      expect(screen.getByRole("heading", { name: category.name })).toBeInTheDocument();
    }
  });

  it("renders the vertical fallback stack when reduced motion is preferred, even at desktop width", () => {
    mockMatchMedia({ reducedMotion: true, desktop: true });
    render(<ProductStoryScroll categories={categories} />);

    for (const category of categories) {
      expect(screen.getByRole("heading", { name: category.name })).toBeInTheDocument();
    }
  });

  it("every real category image is present in the fallback variant", () => {
    mockMatchMedia({ reducedMotion: false, desktop: false });
    render(<ProductStoryScroll categories={categories} />);

    const images = screen.getAllByRole("img");
    expect(images.length).toBeGreaterThanOrEqual(categories.length);
  });
});
