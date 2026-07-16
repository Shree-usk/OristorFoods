import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FilterControls, type FilterValues } from "@/components/storefront/product/filter-controls";

const baseValues: FilterValues = {
  priceMin: undefined,
  priceMax: undefined,
  allergens: [],
  certifications: [],
  brands: [],
  inStock: false,
};

describe("FilterControls", () => {
  it("toggles an allergen on when its checkbox is checked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterControls
        values={baseValues}
        onChange={onChange}
        allergenOptions={[{ value: "Peanuts", label: "Peanuts" }]}
        certificationOptions={[]}
        brandOptions={[]}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Peanuts" }));

    expect(onChange).toHaveBeenCalledWith({ ...baseValues, allergens: ["Peanuts"] });
  });

  it("updates priceMin when the min price input changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterControls
        values={baseValues}
        onChange={onChange}
        allergenOptions={[]}
        certificationOptions={[]}
        brandOptions={[]}
      />,
    );

    await user.type(screen.getByLabelText("Minimum price"), "5");

    expect(onChange).toHaveBeenLastCalledWith({ ...baseValues, priceMin: 5 });
  });

  it("resets all values when Clear filters is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterControls
        values={{ ...baseValues, allergens: ["Peanuts"], inStock: true }}
        onChange={onChange}
        allergenOptions={[{ value: "Peanuts", label: "Peanuts" }]}
        certificationOptions={[]}
        brandOptions={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(onChange).toHaveBeenCalledWith(baseValues);
  });
});
