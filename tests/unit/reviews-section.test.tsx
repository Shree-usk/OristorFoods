import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewsSection } from "@/components/storefront/product/reviews/reviews-section";
import type { ReviewSummary } from "@/services/product-detail-extensions";
import type { PublicReview } from "@/types/review";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

function review(id: string, rating: number, title: string, extra: Partial<PublicReview> = {}): PublicReview {
  return { id, authorName: "Nadeesha", rating, title, body: "Lovely and fresh.", isVerifiedPurchase: false, publishedAt: "2026-09-01T00:00:00.000Z", ...extra };
}

const summary: ReviewSummary = {
  averageRating: 4.5,
  reviewCount: 2,
  histogram: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
  previewReviews: [review("r1", 5, "Fiery and fresh", { isVerifiedPurchase: true }), review("r2", 4, "Good everyday chilli")],
};

function renderSection(value: ReviewSummary | null = summary) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReviewsSection productSlug="chilli" summary={value} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  fetchMock.mockReset();
});

describe("ReviewsSection", () => {
  it("renders the server-provided first page without fetching", () => {
    renderSection();

    expect(screen.getByRole("heading", { level: 2, name: "Customer Reviews" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Fiery and fresh" })).toBeInTheDocument();
    expect(screen.getByText("Verified Purchase")).toBeInTheDocument();
    expect(screen.getByText("Showing 1–2 of 2 reviews")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows only the empty state when there are no reviews", () => {
    renderSection(null);

    expect(screen.getByText("No reviews yet. Be the first to review this product.")).toBeInTheDocument();
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });

  it("fetches the filtered list when a histogram row is chosen, and clears the filter", async () => {
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ items: [summary.previewReviews[0]], total: 1, page: 1, pageSize: 10 }), { status: 200 }),
    );
    renderSection();

    await userEvent.click(screen.getByRole("button", { name: "Show 5-star reviews (1)" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Good everyday chilli" })).not.toBeInTheDocument());
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/products/chilli/reviews?page=1&pageSize=10&sort=recent&rating=5");
    expect(screen.getByText("Showing 1–1 of 1 5-star reviews")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear star filter" }));
    expect(await screen.findByRole("heading", { name: "Good everyday chilli" })).toBeInTheDocument();
  });

  it("pages forward with Next", async () => {
    const many: ReviewSummary = { ...summary, reviewCount: 12, previewReviews: summary.previewReviews };
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ items: [review("r11", 3, "Page two review")], total: 12, page: 2, pageSize: 10 }), { status: 200 }),
    );
    renderSection(many);

    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByRole("heading", { name: "Page two review" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/products/chilli/reviews?page=2&pageSize=10&sort=recent");
  });
});
