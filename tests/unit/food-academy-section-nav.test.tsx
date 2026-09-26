import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FoodAcademySectionNav } from "@/components/storefront/food-academy/food-academy-section-nav";

describe("FoodAcademySectionNav", () => {
  it("renders a keyboard-focusable anchor link per section, in order", () => {
    render(
      <FoodAcademySectionNav
        sections={[
          { sectionNumber: 1, title: "Gather your tools" },
          { sectionNumber: 2, title: "Make the cut" },
        ]}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Gather your tools", "Make the cut"]);
    expect(links[0]).toHaveAttribute("href", "#section-1");
    expect(links[1]).toHaveAttribute("href", "#section-2");
  });

  it("renders nothing for an empty section list", () => {
    const { container } = render(<FoodAcademySectionNav sections={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
