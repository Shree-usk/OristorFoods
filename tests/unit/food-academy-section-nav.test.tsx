import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FoodAcademySectionNav } from "@/components/storefront/food-academy/food-academy-section-nav";

describe("FoodAcademySectionNav", () => {
  it("renders a keyboard-focusable anchor link per section, in order, for both the mobile and desktop nav", () => {
    render(
      <FoodAcademySectionNav
        sections={[
          { sectionNumber: 1, title: "Gather your tools" },
          { sectionNumber: 2, title: "Make the cut" },
        ]}
      />,
    );

    // Below `lg`, no sidebar nav exists at all — the component must render
    // two distinct nav landmarks (mobile inline + desktop sticky), each
    // with the same links in the same order.
    const navs = screen.getAllByRole("navigation");
    expect(navs).toHaveLength(2);

    for (const nav of navs) {
      const links = within(nav).getAllByRole("link");
      expect(links.map((link) => link.textContent)).toEqual(["Gather your tools", "Make the cut"]);
      expect(links[0]).toHaveAttribute("href", "#section-1");
      expect(links[1]).toHaveAttribute("href", "#section-2");
    }
  });

  it("renders nothing for an empty section list", () => {
    const { container } = render(<FoodAcademySectionNav sections={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
