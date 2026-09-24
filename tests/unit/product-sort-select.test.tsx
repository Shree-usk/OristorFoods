import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProductSortSelect } from "@/components/storefront/product/product-sort-select";

describe("ProductSortSelect", () => {
  it("shows the current sort value", () => {
    render(<ProductSortSelect value="newest" onValueChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Newest");
  });

  it("calls onValueChange when a new option is selected", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ProductSortSelect value="newest" onValueChange={onValueChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Price: Low to High" }));

    expect(onValueChange).toHaveBeenCalledWith("price-asc");
  });

  it("disables the best-selling and rating options", async () => {
    const user = userEvent.setup();
    render(<ProductSortSelect value="newest" onValueChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByRole("option", { name: /Best Selling/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("does not show Relevance by default", async () => {
    render(<ProductSortSelect value="newest" onValueChange={vi.fn()} />);

    // Base UI Select renders options into a portal only once opened —
    // check the trigger doesn't advertise it and no option exists to open to.
    expect(screen.queryByText("Relevance")).not.toBeInTheDocument();
  });

  it("shows Relevance when showRelevance is true", async () => {
    render(<ProductSortSelect value="relevance" onValueChange={vi.fn()} showRelevance />);

    expect(screen.getByText("Relevance")).toBeVisible();
  });

  it("labels the trigger for screen readers", () => {
    render(<ProductSortSelect value="newest" onValueChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Sort products" })).toBeInTheDocument();
  });
});
