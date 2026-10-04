import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductStoryScroll } from "@/components/storefront/story/product-story-scroll";
import { productStoryCategories } from "@/lib/story-content";

/**
 * STORY-073. Mirrors scroll-reveal.test.tsx/compare-view.test.tsx's
 * mockMatchMedia pattern, extended to differentiate between the two
 * media queries this component reads (`prefers-reduced-motion` and
 * `min-width: 1024px`) rather than applying one boolean to both, since
 * their combination is exactly what decides which variant renders.
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

describe("ProductStoryScroll", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the pinned desktop variant at desktop width with no reduced-motion preference", () => {
    mockMatchMedia({ reducedMotion: false, desktop: true });
    const { container } = render(<ProductStoryScroll />);

    // The pinned variant's tall scroll-length wrapper has an explicit inline height.
    expect(container.querySelector('[style*="height"]')).not.toBeNull();
  });

  it("renders the vertical fallback stack at mobile width", () => {
    mockMatchMedia({ reducedMotion: false, desktop: false });
    render(<ProductStoryScroll />);

    for (const category of productStoryCategories) {
      expect(screen.getByRole("heading", { name: category.name })).toBeInTheDocument();
    }
  });

  it("renders the vertical fallback stack when reduced motion is preferred, even at desktop width", () => {
    mockMatchMedia({ reducedMotion: true, desktop: true });
    render(<ProductStoryScroll />);

    for (const category of productStoryCategories) {
      expect(screen.getByRole("heading", { name: category.name })).toBeInTheDocument();
    }
  });

  it("every real category image is present in the fallback variant", () => {
    mockMatchMedia({ reducedMotion: false, desktop: false });
    render(<ProductStoryScroll />);

    const images = screen.getAllByRole("img");
    expect(images.length).toBeGreaterThanOrEqual(productStoryCategories.length);
  });
});
