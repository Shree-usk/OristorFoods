import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Breadcrumbs } from "@/components/storefront/layout/breadcrumbs";

describe("Breadcrumbs", () => {
  it("renders each item as a link except the last, which is the current page", () => {
    render(
      <Breadcrumbs
        items={[
          { name: "Spices", href: "/products/spices" },
          { name: "Curry Powder", href: "/products/curry-powder" },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "Spices" })).toHaveAttribute("href", "/products/spices");
    expect(screen.getByText("Curry Powder")).toHaveAttribute("aria-current", "page");
  });
});
