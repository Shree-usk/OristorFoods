// tests/unit/image-placeholder.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ImagePlaceholder } from "@/components/storefront/product/image-placeholder";

describe("ImagePlaceholder", () => {
  it("shows 'No image available' text by default", () => {
    render(<ImagePlaceholder />);
    expect(screen.getByText("No image available")).toBeInTheDocument();
  });

  it("shows an icon with no visible text for size='sm'", () => {
    const { container } = render(<ImagePlaceholder size="sm" />);
    expect(screen.queryByText("No image available")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
