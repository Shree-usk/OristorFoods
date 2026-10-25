// tests/unit/export-hero.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExportHero } from "@/components/storefront/home/export-hero";
import type { ExportHeroData } from "@/types/home";

function makeData(overrides: Partial<ExportHeroData> = {}): ExportHeroData {
  return {
    backgroundImageUrl: null,
    backgroundImageAlt: null,
    eyebrow: "Oristor Export Solutions",
    headline: "Bring the Taste of **Sri Lanka** to Your Market.",
    description: "Authentic Sri Lankan condiments for distributors, importers and retail partners.",
    primaryCtaLabel: "Explore Export Catalogue",
    primaryCtaHref: "/export",
    secondaryCtaLabel: "Become a Distribution Partner",
    secondaryCtaHref: "/export#enquiry",
    statLine: [
      { label: "Authentic Sri Lankan Range", description: "Distinctive local flavours" },
      { label: "Export Enquiries", description: "Connect with our team" },
    ],
    badge: {
      eyebrow: "For Global Partners",
      headline: "From Sri Lanka. Ready for the world.",
      description: "Explore our export collection.",
      ctaLabel: "View Export Collection",
      ctaHref: "/export",
    },
    ...overrides,
  };
}

describe("ExportHero", () => {
  it("renders a decorative (alt=\"\") background image when configured", () => {
    render(<ExportHero data={makeData({ backgroundImageUrl: "/images/export/hero.webp", backgroundImageAlt: "Spices" })} />);
    const image = document.querySelector("img");
    expect(image).not.toBeNull();
    expect(image).toHaveAttribute("alt", "");
  });

  it("renders no background image when unset", () => {
    render(<ExportHero data={makeData({ backgroundImageUrl: null })} />);
    expect(document.querySelector("img")).toBeNull();
  });

  it("highlights the marked span of the headline and leaves the rest plain", () => {
    render(<ExportHero data={makeData()} />);
    const highlighted = screen.getByText("Sri Lanka");
    expect(highlighted.className).toContain("text-gold");
    expect(screen.getByText(/Bring the Taste of/)).toBeInTheDocument();
  });

  it("renders both CTAs linking to their configured hrefs", () => {
    render(<ExportHero data={makeData()} />);
    // Base UI's Button-as-link renders role="button" on the anchor, not role="link".
    expect(screen.getByRole("button", { name: /Explore Export Catalogue/ })).toHaveAttribute("href", "/export");
    expect(screen.getByRole("button", { name: /Become a Distribution Partner/ })).toHaveAttribute("href", "/export#enquiry");
  });

  it("renders the stat line items and omits the row entirely when empty", () => {
    const { rerender } = render(<ExportHero data={makeData()} />);
    expect(screen.getByText("Authentic Sri Lankan Range")).toBeInTheDocument();
    expect(screen.getByText("Export Enquiries")).toBeInTheDocument();

    rerender(<ExportHero data={makeData({ statLine: [] })} />);
    expect(screen.queryByText("Authentic Sri Lankan Range")).not.toBeInTheDocument();
  });

  it("renders the floating badge card when configured and omits it when not", () => {
    const { rerender } = render(<ExportHero data={makeData()} />);
    expect(screen.getByText("From Sri Lanka. Ready for the world.")).toBeInTheDocument();

    rerender(<ExportHero data={makeData({ badge: null })} />);
    expect(screen.queryByText("From Sri Lanka. Ready for the world.")).not.toBeInTheDocument();
  });
});
