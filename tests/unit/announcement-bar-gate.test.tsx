import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// jsdom has no Next.js app router mounted in these component tests —
// matching the existing pattern in tests/unit/compare-view.test.tsx, mock
// next/navigation locally rather than rendering under a real router.
const mockUsePathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

const { AnnouncementBarGate } = await import("@/components/storefront/layout/announcement-bar-gate");

describe("AnnouncementBarGate", () => {
  it("renders children on an ordinary storefront route", () => {
    mockUsePathname.mockReturnValue("/products");
    render(<AnnouncementBarGate>Promo</AnnouncementBarGate>);
    expect(screen.getByText("Promo")).toBeInTheDocument();
  });

  it("hides children on /export", () => {
    mockUsePathname.mockReturnValue("/export");
    const { container } = render(<AnnouncementBarGate>Promo</AnnouncementBarGate>);
    expect(container).toBeEmptyDOMElement();
  });

  it("hides children on an /export subpage too", () => {
    mockUsePathname.mockReturnValue("/export/catalogue/premium-range");
    const { container } = render(<AnnouncementBarGate>Promo</AnnouncementBarGate>);
    expect(container).toBeEmptyDOMElement();
  });
});
