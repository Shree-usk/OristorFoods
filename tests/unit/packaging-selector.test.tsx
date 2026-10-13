import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PackagingSelector } from "@/components/storefront/product/packaging-selector";
import type { ProductDetailPackagingOption } from "@/services/product.service";

function makeOption(overrides: Partial<ProductDetailPackagingOption> = {}): ProductDetailPackagingOption {
  return {
    id: "option-1",
    variantId: null,
    packagingMethodName: "Vacuum Pouch",
    packagingMethodImage: null,
    charge: 500,
    minQuantity: null,
    availability: "Both",
    leadTimeDays: null,
    shelfLifeDays: null,
    shelfLifeText: null,
    customerInstructions: null,
    acknowledgementText: null,
    ...overrides,
  };
}

const noop = () => {};

describe("PackagingSelector", () => {
  it("renders an icon for an option whose packaging method has an image, and no icon when it doesn't", () => {
    const options = [makeOption({ id: "with-image", packagingMethodImage: "/pouch.webp" }), makeOption({ id: "no-image", packagingMethodName: "Foil Packing" })];
    const { container } = render(
      <PackagingSelector options={options} selectedVariantId={null} currency="LKR" value={{ optionId: "", declaredAvailability: "Local" }} onChange={noop} acknowledged={false} onAcknowledgedChange={noop} />,
    );

    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("src", "/pouch.webp");
  });

  it("uses the option's own acknowledgementText when set, and a default sentence when it isn't", () => {
    const withCustomText = makeOption({ id: "custom", acknowledgementText: "I agree to collect this myself." });
    const { rerender } = render(
      <PackagingSelector
        options={[withCustomText]}
        selectedVariantId={null}
        currency="LKR"
        value={{ optionId: "custom", declaredAvailability: "Local" }}
        onChange={noop}
        acknowledged={false}
        onAcknowledgedChange={noop}
      />,
    );
    expect(screen.getByText("I agree to collect this myself.")).toBeInTheDocument();

    const withoutCustomText = makeOption({ id: "default" });
    rerender(
      <PackagingSelector
        options={[withoutCustomText]}
        selectedVariantId={null}
        currency="LKR"
        value={{ optionId: "default", declaredAvailability: "Local" }}
        onChange={noop}
        acknowledged={false}
        onAcknowledgedChange={noop}
      />,
    );
    expect(screen.getByText("I understand this packaging's lead time and shelf life as described above.")).toBeInTheDocument();
  });

  it("renders customerInstructions as a numbered list when multi-line", () => {
    const option = makeOption({ id: "multi", customerInstructions: "Keep refrigerated.\nDo not freeze." });
    render(
      <PackagingSelector
        options={[option]}
        selectedVariantId={null}
        currency="LKR"
        value={{ optionId: "multi", declaredAvailability: "Local" }}
        onChange={noop}
        acknowledged={false}
        onAcknowledgedChange={noop}
      />,
    );
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Keep refrigerated.", "Do not freeze."]);
  });

  it("selecting an option calls onChange with the option id and the current declaration", () => {
    const onChange = vi.fn();
    const option = makeOption();
    render(
      <PackagingSelector options={[option]} selectedVariantId={null} currency="LKR" value={{ optionId: "", declaredAvailability: "Export" }} onChange={onChange} acknowledged={false} onAcknowledgedChange={noop} />,
    );
    screen.getByText(/Vacuum Pouch/).closest("button")!.click();
    expect(onChange).toHaveBeenCalledWith({ optionId: "option-1", declaredAvailability: "Export" });
  });
});
