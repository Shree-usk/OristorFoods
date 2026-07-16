import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SortSelect } from "@/components/storefront/product/sort-select";

describe("SortSelect", () => {
  it("shows the current sort value", () => {
    render(<SortSelect value="newest" onValueChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Newest");
  });

  it("calls onValueChange when a new option is selected", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SortSelect value="newest" onValueChange={onValueChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Price: Low to High" }));

    expect(onValueChange).toHaveBeenCalledWith("price-asc");
  });

  it("disables the best-selling and rating options", async () => {
    const user = userEvent.setup();
    render(<SortSelect value="newest" onValueChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByRole("option", { name: /Best Selling/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
