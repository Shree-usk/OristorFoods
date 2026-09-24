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

  it("names every checkbox by its text alone, not by an ancestor label that contains the checkbox", () => {
    // Base UI otherwise points aria-labelledby at the wrapping <label>, which
    // contains the checkbox itself — axe (aria-toggle-field-name) resolves
    // that self-reference to an empty name.
    render(
      <FilterControls
        values={baseValues}
        onChange={vi.fn()}
        allergenOptions={[{ value: "Peanuts", label: "Peanuts" }]}
        certificationOptions={[{ value: "Halal", label: "Halal" }]}
        brandOptions={[{ value: "oristor", label: "Oristor" }]}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(4);
    for (const checkbox of checkboxes) {
      const labelledBy = checkbox.getAttribute("aria-labelledby");
      const labelElement = labelledBy ? document.getElementById(labelledBy) : null;
      expect(labelElement).not.toBeNull();
      expect(labelElement?.contains(checkbox)).toBe(false);
      expect(labelElement?.textContent?.trim()).not.toBe("");
    }
    expect(screen.getByRole("checkbox", { name: "Oristor" })).toBeDefined();
    expect(screen.getByRole("checkbox", { name: "In stock only" })).toBeDefined();
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
