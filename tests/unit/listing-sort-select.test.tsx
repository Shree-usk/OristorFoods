import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SortSelect, type SortOption } from "@/components/storefront/listing/sort-select";

type Sort = "a" | "b" | "c";
const options: SortOption<Sort>[] = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma", disabled: true },
];

describe("SortSelect (shared)", () => {
  it("shows the selected option's label and the given aria-label", () => {
    render(<SortSelect value="b" options={options} onValueChange={vi.fn()} ariaLabel="Sort things" />);
    expect(screen.getByRole("combobox", { name: "Sort things" })).toHaveTextContent("Beta");
  });

  it("calls onValueChange with the chosen value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SortSelect value="a" options={options} onValueChange={onValueChange} ariaLabel="Sort things" />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Beta" }));

    expect(onValueChange).toHaveBeenCalledWith("b");
  });

  it("marks disabled options as coming soon", async () => {
    const user = userEvent.setup();
    render(<SortSelect value="a" options={options} onValueChange={vi.fn()} ariaLabel="Sort things" />);

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByRole("option", { name: "Gamma (coming soon)" })).toHaveAttribute("aria-disabled", "true");
  });
});
