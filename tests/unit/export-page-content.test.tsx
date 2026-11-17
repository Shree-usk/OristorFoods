import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExportBuyerJourney } from "@/components/storefront/export/export-buyer-journey";
import { ExportCertificationStrip } from "@/components/storefront/export/export-certification-strip";
import { ExportPageHero } from "@/components/storefront/export/export-page-hero";
import { ExportSolutionsGrid } from "@/components/storefront/export/export-solutions-grid";

describe("ExportPageHero", () => {
  it("renders the headline, description, and both CTAs with real hrefs", () => {
    render(
      <ExportPageHero
        data={{
          backgroundImageUrl: "/images/export-hero.webp",
          backgroundImageAlt: "Export products",
          eyebrow: "Export Solutions",
          headline: "Partner with Oristor for Global Distribution",
          description: "From single-origin sourcing to bulk export packaging.",
          primaryCtaLabel: "Explore Export Catalogue",
          primaryCtaHref: "/export#catalogue",
          secondaryCtaLabel: "Download Brochure",
          secondaryCtaHref: "/downloads/brochure",
        }}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Partner with Oristor for Global Distribution" })).toBeInTheDocument();
    // Base UI's Button-as-link renders role="button" on the anchor, not role="link".
    expect(screen.getByRole("button", { name: "Explore Export Catalogue" })).toHaveAttribute("href", "/export#catalogue");
    expect(screen.getByRole("button", { name: "Download Brochure" })).toHaveAttribute("href", "/downloads/brochure");
  });

  it("omits the image and CTA row gracefully when unset", () => {
    const { container } = render(
      <ExportPageHero data={{ backgroundImageUrl: null, backgroundImageAlt: null, eyebrow: null, headline: "Headline", description: null, primaryCtaLabel: null, primaryCtaHref: null, secondaryCtaLabel: null, secondaryCtaHref: null }} />,
    );
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("ExportCertificationStrip", () => {
  it("renders every certification's name", () => {
    render(
      <ExportCertificationStrip
        certifications={[
          { id: "1", name: "ISO 22000", certificateImage: "/certs/iso.png" },
          { id: "2", name: "HACCP", certificateImage: null },
        ]}
      />,
    );
    expect(screen.getByText("ISO 22000")).toBeInTheDocument();
    expect(screen.getByText("HACCP")).toBeInTheDocument();
  });

  it("renders nothing when there are no certifications", () => {
    const { container } = render(<ExportCertificationStrip certifications={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ExportSolutionsGrid", () => {
  it("renders a centered heading and every card", () => {
    render(
      <ExportSolutionsGrid
        cards={[
          { id: "1", icon: "Package", title: "Bulk & Foodservice Supply", description: "Industrial quantities." },
          { id: "2", icon: "Tag", title: "Private Label / OEM", description: "Custom branding." },
        ]}
      />,
    );
    const heading = screen.getByRole("heading", { level: 2, name: "Export Solutions" });
    expect(heading).toHaveClass("text-center");
    expect(screen.getByText("Bulk & Foodservice Supply")).toBeInTheDocument();
    expect(screen.getByText("Private Label / OEM")).toBeInTheDocument();
  });

  it("renders nothing when there are no cards", () => {
    const { container } = render(<ExportSolutionsGrid cards={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ExportBuyerJourney", () => {
  it("renders a centered heading and every step in order", () => {
    render(
      <ExportBuyerJourney
        steps={[
          { id: "1", icon: "FileText", title: "Inquiry", description: "Tell us your products." },
          { id: "2", icon: "Truck", title: "Shipment", description: "Shipped to your port." },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Our Export Process" })).toHaveClass("text-center");
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText("Inquiry")).toBeInTheDocument();
    expect(screen.getByText("Shipment")).toBeInTheDocument();
  });

  it("renders nothing when there are no steps", () => {
    const { container } = render(<ExportBuyerJourney steps={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
