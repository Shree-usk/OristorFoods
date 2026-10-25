// tests/unit/export-banner.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExportBanner } from "@/components/storefront/home/export-banner";
import type { TeaserSectionData } from "@/types/home";

const exportSolutions: TeaserSectionData = {
  eyebrow: "Export Solutions",
  headline: "Partner with Oristor for Global Distribution",
  description: "From single-origin sourcing to bulk export packaging, we work with distributors, importers, and retailers worldwide.",
  ctaLabel: "Explore Export Catalogue",
  ctaHref: "/export",
  imageSrc: "/images/products/export/Kithul-Jaggery-500g.png",
  imageAlt: "Oristor Kithul jaggery export packaging",
};

describe("ExportBanner", () => {
  it("renders the eyebrow, headline, description, and a CTA linking to the export catalogue", () => {
    render(<ExportBanner data={exportSolutions} />);

    expect(screen.getByText(exportSolutions.eyebrow)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: exportSolutions.headline })).toBeInTheDocument();
    expect(screen.getByText(exportSolutions.description)).toBeInTheDocument();

    // Base UI's Button-as-link renders role="button" on the anchor, not role="link".
    const cta = screen.getByRole("button", { name: exportSolutions.ctaLabel });
    expect(cta).toHaveAttribute("href", "/export");
  });
});
