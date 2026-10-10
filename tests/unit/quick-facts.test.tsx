import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QuickFacts } from "@/components/storefront/product/quick-facts";

describe("QuickFacts", () => {
  it("renders nothing when there are no benefits", () => {
    const { container } = render(<QuickFacts benefits={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders each benefit as a chip, up to the first 4", () => {
    render(<QuickFacts benefits={["Rich in antioxidants", "High in fibre", "No preservatives", "Gluten free", "Vegan"]} />);

    expect(screen.getByText("Rich in antioxidants")).toBeInTheDocument();
    expect(screen.getByText("Gluten free")).toBeInTheDocument();
    expect(screen.queryByText("Vegan")).not.toBeInTheDocument();
  });
});
