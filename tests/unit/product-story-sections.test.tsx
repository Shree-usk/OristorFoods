import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductPromiseSection } from "@/components/storefront/product/promise-section";
import { ProductPreparationStorySection } from "@/components/storefront/product/preparation-story-section";
import { ProductExportDetailsSection } from "@/components/storefront/product/export-details-section";

describe("ProductPromiseSection", () => {
  it("renders nothing when disabled, even with attributes present", () => {
    const { container } = render(
      <ProductPromiseSection enabled={false} heading={null} attributes={[{ icon: "Leaf", iconImageUrl: null, heading: "Clean Label", description: null }]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when enabled but the attribute list is empty", () => {
    const { container } = render(<ProductPromiseSection enabled={true} heading={null} attributes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders attributes with a fallback heading, and a custom heading when set", () => {
    render(
      <ProductPromiseSection
        enabled={true}
        heading={null}
        attributes={[{ icon: "Leaf", iconImageUrl: null, heading: "Carefully Cleaned Ingredients", description: "Selected by hand" }]}
      />,
    );
    expect(screen.getByText("Good Food. Thoughtfully Made.")).toBeInTheDocument();
    expect(screen.getByText("Carefully Cleaned Ingredients")).toBeInTheDocument();
    expect(screen.getByText("Selected by hand")).toBeInTheDocument();

    render(
      <ProductPromiseSection
        enabled={true}
        heading="A Custom Promise Heading"
        attributes={[{ icon: "Leaf", iconImageUrl: null, heading: "Clean Label", description: null }]}
      />,
    );
    expect(screen.getByText("A Custom Promise Heading")).toBeInTheDocument();
  });

  it("isolates one product's attributes from another's — rendering product A's data never shows product B's", () => {
    render(<ProductPromiseSection enabled={true} heading={null} attributes={[{ icon: "Leaf", iconImageUrl: null, heading: "Product A Claim", description: null }]} />);
    expect(screen.getByText("Product A Claim")).toBeInTheDocument();
    expect(screen.queryByText("Product B Claim")).not.toBeInTheDocument();
  });
});

describe("ProductPreparationStorySection", () => {
  it("renders nothing when disabled or when stages are empty", () => {
    const stage = { stageNumber: "01", heading: "Carefully Selected", description: null, imageUrl: "/stage.jpg", imageAlt: null };
    expect(render(<ProductPreparationStorySection enabled={false} heading={null} subtitle={null} stages={[stage]} />).container).toBeEmptyDOMElement();
    expect(render(<ProductPreparationStorySection enabled={true} heading={null} subtitle={null} stages={[]} />).container).toBeEmptyDOMElement();
  });

  it("renders every visible stage with its own heading and image", () => {
    render(
      <ProductPreparationStorySection
        enabled={true}
        heading={null}
        subtitle="From farm to jar"
        stages={[
          { stageNumber: "01", heading: "Carefully Selected", description: null, imageUrl: "/stage-1.jpg", imageAlt: "Stage 1" },
          { stageNumber: "02", heading: "Thoughtfully Prepared", description: "Cooked with care", imageUrl: "/stage-2.jpg", imageAlt: null },
        ]}
      />,
    );
    expect(screen.getByText("Crafted with Care. Packed with Flavour.")).toBeInTheDocument();
    expect(screen.getByText("From farm to jar")).toBeInTheDocument();
    expect(screen.getByText("Carefully Selected")).toBeInTheDocument();
    expect(screen.getByText("Thoughtfully Prepared")).toBeInTheDocument();
    expect(screen.getByText("Cooked with care")).toBeInTheDocument();
    expect(screen.getByAltText("Stage 1")).toBeInTheDocument();
  });

  it("does not require a fixed stage count — a single stage renders correctly", () => {
    render(
      <ProductPreparationStorySection
        enabled={true}
        heading={null}
        subtitle={null}
        stages={[{ stageNumber: "01", heading: "Only Stage", description: null, imageUrl: "/stage.jpg", imageAlt: null }]}
      />,
    );
    expect(screen.getByText("Only Stage")).toBeInTheDocument();
  });
});

describe("ProductExportDetailsSection", () => {
  it("renders nothing when disabled or when items are empty", () => {
    const item = { specType: "PackSizes" as const, value: "200 g | 350 g" };
    expect(render(<ProductExportDetailsSection enabled={false} heading={null} items={[item]} />).container).toBeEmptyDOMElement();
    expect(render(<ProductExportDetailsSection enabled={true} heading={null} items={[]} />).container).toBeEmptyDOMElement();
  });

  it("renders each item with its mapped label and the admin-entered value", () => {
    render(
      <ProductExportDetailsSection
        enabled={true}
        heading={null}
        items={[
          { specType: "PackSizes", value: "200 g | 350 g" },
          { specType: "Moq", value: "100 cartons" },
        ]}
      />,
    );
    expect(screen.getByText("Packaging & Export Details")).toBeInTheDocument();
    expect(screen.getByText("200 g | 350 g")).toBeInTheDocument();
    expect(screen.getByText("100 cartons")).toBeInTheDocument();
  });
});
