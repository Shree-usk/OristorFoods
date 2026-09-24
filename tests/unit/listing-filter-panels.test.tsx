import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { FilterDrawer } from "@/components/storefront/listing/filter-drawer";
import { FilterSidebar } from "@/components/storefront/listing/filter-sidebar";

describe("FilterSidebar", () => {
  it("renders its children in a labelled complementary landmark", () => {
    render(
      <FilterSidebar label="Filter recipes">
        <p>controls</p>
      </FilterSidebar>,
    );

    expect(screen.getByRole("complementary", { name: "Filter recipes" })).toHaveTextContent("controls");
  });
});

describe("FilterDrawer", () => {
  it("shows its children in a dialog once opened", async () => {
    const user = userEvent.setup();
    render(
      <FilterDrawer>
        <p>drawer controls</p>
      </FilterDrawer>,
    );

    expect(screen.queryByText("drawer controls")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filters" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("drawer controls");
    expect(dialog).toHaveTextContent("Filters");
  });
});
