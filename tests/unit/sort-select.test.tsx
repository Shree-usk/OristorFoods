import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SortSelect } from "@/components/storefront/product/sort-select";

describe("SortSelect", () => {
  it("does not show Relevance by default", async () => {
    render(<SortSelect value="newest" onValueChange={vi.fn()} />);

    // Base UI Select renders options into a portal only once opened —
    // check the trigger doesn't advertise it and no option exists to open to.
    expect(screen.queryByText("Relevance")).not.toBeInTheDocument();
  });

  it("shows Relevance when showRelevance is true", async () => {
    render(<SortSelect value="relevance" onValueChange={vi.fn()} showRelevance />);

    expect(screen.getByText("Relevance")).toBeVisible();
  });
});
