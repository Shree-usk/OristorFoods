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
    chargeType: "Fixed",
    charge: 500,
    ratePerGram: null,
    minOrderWeightGrams: null,
    minPackagingCharge: null,
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
      <PackagingSelector
        options={options}
        selectedVariantId={null}
        selectedVariantNetWeightGrams={null}
        quantity={1}
        currency="LKR"
        value={{ optionId: "", declaredAvailability: "Local" }}
        onChange={noop}
        acknowledged={false}
        onAcknowledgedChange={noop}
      />,
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
        selectedVariantNetWeightGrams={null}
        quantity={1}
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
        selectedVariantNetWeightGrams={null}
        quantity={1}
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
        selectedVariantNetWeightGrams={null}
        quantity={1}
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
      <PackagingSelector
        options={[option]}
        selectedVariantId={null}
        selectedVariantNetWeightGrams={null}
        quantity={1}
        currency="LKR"
        value={{ optionId: "", declaredAvailability: "Export" }}
        onChange={onChange}
        acknowledged={false}
        onAcknowledgedChange={noop}
      />,
    );
    screen.getByText(/Vacuum Pouch/).closest("button")!.click();
    expect(onChange).toHaveBeenCalledWith({ optionId: "option-1", declaredAvailability: "Export" });
  });

  it("shows the live-calculated charge for a selected PerGram option, recomputed from weight x quantity x rate", () => {
    const option = makeOption({ id: "per-gram", chargeType: "PerGram", charge: 0, ratePerGram: 0.5 });
    render(
      <PackagingSelector
        options={[option]}
        selectedVariantId={null}
        selectedVariantNetWeightGrams={200}
        quantity={3}
        currency="LKR"
        value={{ optionId: "per-gram", declaredAvailability: "Local" }}
        onChange={noop}
        acknowledged={false}
        onAcknowledgedChange={noop}
      />,
    );
    // 200g x 3 x LKR 0.50/g = LKR 300
    expect(screen.getByText(/Packaging charge: \+LKR 300/)).toBeInTheDocument();
    expect(screen.getByText(/Eligible weight: 600g/)).toBeInTheDocument();
  });

  it("blocks a PerGram selection below its configured minimum order weight with a clear message", () => {
    const option = makeOption({ id: "per-gram", chargeType: "PerGram", charge: 0, ratePerGram: 0.5, minOrderWeightGrams: 1000 });
    render(
      <PackagingSelector
        options={[option]}
        selectedVariantId={null}
        selectedVariantNetWeightGrams={200}
        quantity={1}
        currency="LKR"
        value={{ optionId: "per-gram", declaredAvailability: "Local" }}
        onChange={noop}
        acknowledged={false}
        onAcknowledgedChange={noop}
      />,
    );
    expect(screen.getByText(/minimum order weight of 1000g/)).toBeInTheDocument();
    expect(screen.queryByText(/Packaging charge:/)).not.toBeInTheDocument();
  });
});
