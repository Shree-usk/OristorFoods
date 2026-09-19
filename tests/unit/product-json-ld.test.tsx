import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductJsonLd } from "@/components/storefront/product/product-json-ld";

describe("ProductJsonLd", () => {
  it("renders a schema.org Product script with offer details", () => {
    const { container } = render(
      <ProductJsonLd
        name="Curry Powder"
        description="Roasted curry powder"
        imageUrls={["/curry.jpg"]}
        sku="SKU-1"
        price={650}
        currency="LKR"
        inStock={true}
        url="https://oristor.com/products/curry-powder"
      />,
    );

    const script = container.querySelector('script[type="application/ld+json"]');
    const json = JSON.parse(script?.innerHTML ?? "{}");

    expect(json["@type"]).toBe("Product");
    expect(json.sku).toBe("SKU-1");
    expect(json.offers.price).toBe(650);
    expect(json.offers.availability).toBe("https://schema.org/InStock");
  });

  it("marks out-of-stock availability correctly", () => {
    const { container } = render(
      <ProductJsonLd
        name="Curry Powder"
        description={null}
        imageUrls={[]}
        sku="SKU-1"
        price={650}
        currency="LKR"
        inStock={false}
        url="https://oristor.com/products/curry-powder"
      />,
    );

    const script = container.querySelector('script[type="application/ld+json"]');
    const json = JSON.parse(script?.innerHTML ?? "{}");

    expect(json.offers.availability).toBe("https://schema.org/OutOfStock");
  });
});
