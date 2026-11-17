import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExportBuyerJourney } from "@/components/storefront/export/export-buyer-journey";
import { ExportCatalogueCategorySections } from "@/components/storefront/export/export-catalogue-category-sections";
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
  it("renders every item's label, independent of Certification master data", () => {
    render(
      <ExportCertificationStrip
        items={[
          { id: "1", label: "ISO 22000", imageUrl: "/certs/iso.png" },
          { id: "2", label: "25+ Years of Trust", imageUrl: null },
        ]}
      />,
    );
    expect(screen.getByText("ISO 22000")).toBeInTheDocument();
    expect(screen.getByText("25+ Years of Trust")).toBeInTheDocument();
  });

  it("renders nothing when there are no items", () => {
    const { container } = render(<ExportCertificationStrip items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ExportSolutionsGrid", () => {
  it("renders a centered heading and every card", () => {
    render(
      <ExportSolutionsGrid
        cards={[
          { id: "1", icon: "Package", iconImageUrl: null, title: "Bulk & Foodservice Supply", description: "Industrial quantities." },
          { id: "2", icon: "Tag", iconImageUrl: null, title: "Private Label / OEM", description: "Custom branding." },
        ]}
      />,
    );
    const heading = screen.getByRole("heading", { level: 2, name: "Export Solutions" });
    expect(heading).toHaveClass("text-center");
    expect(screen.getByText("Bulk & Foodservice Supply")).toBeInTheDocument();
    expect(screen.getByText("Private Label / OEM")).toBeInTheDocument();
  });

  it("renders the uploaded icon image instead of the curated icon when set", () => {
    const { container } = render(
      <ExportSolutionsGrid
        cards={[{ id: "1", icon: "Package", iconImageUrl: "/icons/custom.png", title: "Custom", description: "d" }]}
      />,
    );
    expect(container.querySelector("img")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
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
          { id: "1", icon: "FileText", iconImageUrl: null, title: "Inquiry", description: "Tell us your products." },
          { id: "2", icon: "Truck", iconImageUrl: null, title: "Shipment", description: "Shipped to your port." },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Our Export Process" })).toHaveClass("text-center");
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText("Inquiry")).toBeInTheDocument();
    expect(screen.getByText("Shipment")).toBeInTheDocument();
  });

  it("renders the uploaded icon image instead of the curated icon when set", () => {
    const { container } = render(
      <ExportBuyerJourney steps={[{ id: "1", icon: "FileText", iconImageUrl: "/icons/custom.png", title: "Custom", description: "d" }]} />,
    );
    expect(container.querySelector("img")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("renders nothing when there are no steps", () => {
    const { container } = render(<ExportBuyerJourney steps={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ExportCatalogueCategorySections", () => {
  const product = {
    id: "p1",
    sku: "SKU-1",
    slug: "product-1",
    name: "Product One",
    shortDescription: null,
    exportDescription: null,
    weightGrams: null,
    isExportFeatured: false,
    collections: [],
    images: [],
  };

  it("renders a heading per category and 'Uncategorized' for the null-category group", () => {
    render(
      <ExportCatalogueCategorySections
        groups={[
          { category: { id: "c1", name: "Spices", slug: "spices" }, items: [product], total: 1 },
          { category: null, items: [{ ...product, id: "p2", slug: "product-2" }], total: 1 },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Spices" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Uncategorized" })).toBeInTheDocument();
  });

  it("shows a 'View all' link only when total exceeds the items shown", () => {
    render(
      <ExportCatalogueCategorySections
        groups={[
          { category: { id: "c1", name: "Spices", slug: "spices" }, items: [product], total: 10 },
          { category: { id: "c2", name: "Snacks", slug: "snacks" }, items: [product], total: 1 },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "View all in Spices" })).toHaveAttribute("href", "/export?category=spices#catalogue");
    expect(screen.queryByRole("link", { name: "View all in Snacks" })).not.toBeInTheDocument();
  });

  it("renders nothing when there are no groups", () => {
    const { container } = render(<ExportCatalogueCategorySections groups={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
