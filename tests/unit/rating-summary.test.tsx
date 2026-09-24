import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RatingSummary } from "@/components/storefront/product/reviews/rating-summary";

const summary = { averageRating: 4.33, reviewCount: 3, histogram: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 1 } };

describe("RatingSummary", () => {
  it("shows the empty state when there are no reviews", () => {
    render(<RatingSummary summary={null} onSelectRating={vi.fn()} />);

    expect(screen.getByText("No reviews yet. Be the first to review this product.")).toBeInTheDocument();
  });

  it("shows the average, count and a histogram row per star", () => {
    render(<RatingSummary summary={summary} onSelectRating={vi.fn()} />);

    expect(screen.getByText("4.3")).toBeInTheDocument();
    expect(screen.getByText("Based on 3 reviews")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "4.3 out of 5 stars" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show 4-star reviews (2)" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Show 1-star reviews (0)" })).toBeDisabled();
  });

  it("selects a star filter and marks the active row", async () => {
    const onSelectRating = vi.fn();
    render(<RatingSummary summary={summary} activeRating={5} onSelectRating={onSelectRating} />);

    await userEvent.click(screen.getByRole("button", { name: "Show 4-star reviews (2)" }));

    expect(onSelectRating).toHaveBeenCalledWith(4);
    expect(screen.getByRole("button", { name: "Show 5-star reviews (1)" })).toHaveAttribute("aria-pressed", "true");
  });
});
