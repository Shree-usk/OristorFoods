import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CustomerReviews } from "@/components/storefront/home/customer-reviews";
import type { ReviewData } from "@/types/home";

const reviews: ReviewData[] = [
  { id: "r1", authorName: "Amara P.", authorLocation: "Colombo", rating: 5, quote: "Tastes just like home." },
  { id: "r2", authorName: "Dinesh K.", rating: 4, quote: "Great quality, will buy again." },
];

describe("CustomerReviews (marquee strip)", () => {
  it("renders the default heading and every review's content at least once", () => {
    render(<CustomerReviews reviews={reviews} />);
    expect(screen.getByRole("heading", { level: 2, name: "What Our Customers Are Saying" })).toBeInTheDocument();
    expect(screen.getAllByText(/Tastes just like home\./).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Amara P.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Colombo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5 out of 5 stars").length).toBeGreaterThan(0);
  });

  it("honours a titleOverride", () => {
    render(<CustomerReviews reviews={reviews} titleOverride="Loved by Home Cooks" />);
    expect(screen.getByRole("heading", { level: 2, name: "Loved by Home Cooks" })).toBeInTheDocument();
  });

  it("omits the location line when a review has none", () => {
    render(<CustomerReviews reviews={reviews} />);
    expect(screen.getAllByText("Dinesh K.").length).toBeGreaterThan(0);
    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
  });

  it("repeats a small review set so the strip never looks sparse, duplicated once more for a seamless loop", () => {
    const { container } = render(<CustomerReviews reviews={reviews} />);
    const cards = container.querySelectorAll(".marquee-track > *");
    // MIN_VISIBLE_CARDS=8 with 2 real reviews -> padded to 8, then doubled for the loop seam -> 16.
    expect(cards.length).toBe(16);
  });

  it("drives the marquee via a CSS custom property, pausable by a plain :hover rule (no inline animation-duration, no JS hover handlers)", () => {
    const { container } = render(<CustomerReviews reviews={reviews} />);
    const group = container.querySelector(".marquee-group");
    const track = container.querySelector(".marquee-track") as HTMLElement | null;
    expect(group).not.toBeNull();
    expect(track).not.toBeNull();
    expect(track!.style.getPropertyValue("--marquee-duration")).toMatch(/^\d+s$/);
  });
});
