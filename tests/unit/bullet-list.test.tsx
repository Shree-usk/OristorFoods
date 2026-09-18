import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BulletList } from "@/components/storefront/product/bullet-list";

describe("BulletList", () => {
  it("renders the heading and every item", () => {
    render(<BulletList heading="Benefits" items={["Rich in fibre", "No preservatives"]} />);

    expect(screen.getByText("Benefits")).toBeInTheDocument();
    expect(screen.getByText("Rich in fibre")).toBeInTheDocument();
    expect(screen.getByText("No preservatives")).toBeInTheDocument();
  });

  it("renders nothing for an empty item list", () => {
    const { container } = render(<BulletList heading="Benefits" items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
