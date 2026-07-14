import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ScrollReveal } from "@/components/motion/scroll-reveal";

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe("ScrollReveal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children normally when motion is allowed", () => {
    mockMatchMedia(false);
    render(<ScrollReveal>Hello</ScrollReveal>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders children in a plain wrapper (no animation) when reduced motion is preferred", () => {
    mockMatchMedia(true);
    render(<ScrollReveal className="test-class">Hello</ScrollReveal>);
    const el = screen.getByText("Hello");
    expect(el).toBeInTheDocument();
    // Plain <div>, not a motion component, when reduced motion applies.
    expect(el.tagName).toBe("DIV");
    expect(el).toHaveClass("test-class");
  });
});
