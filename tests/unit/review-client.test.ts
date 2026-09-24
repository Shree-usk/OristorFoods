import { afterEach, describe, expect, it, vi } from "vitest";

import { deleteReview, fetchMyReview, fetchReviewPage, postReview, ReviewApiError } from "@/lib/api/review-client";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  fetchMock.mockReset();
});

describe("review-client", () => {
  it("builds the list URL with the rating filter only when set", async () => {
    // mockImplementation, not mockResolvedValue: a Response body can only be read once.
    fetchMock.mockImplementation(async () => json({ items: [], total: 0, page: 2, pageSize: 10 }));

    await fetchReviewPage("curry powder", { page: 2, pageSize: 10, sort: "highest" });
    await fetchReviewPage("curry", { page: 1, pageSize: 10, sort: "recent", rating: 5 });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/products/curry%20powder/reviews?page=2&pageSize=10&sort=highest");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/products/curry/reviews?page=1&pageSize=10&sort=recent&rating=5");
  });

  it("returns the customer's review from /mine", async () => {
    fetchMock.mockResolvedValue(json({ review: null }));

    expect(await fetchMyReview("curry")).toBeNull();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/products/curry/reviews/mine");
  });

  it("throws ReviewApiError with status and field errors", async () => {
    fetchMock.mockResolvedValue(json({ error: "Review must be at least 20 characters", fieldErrors: { body: ["Review must be at least 20 characters"] } }, 400));

    const error = await postReview("curry", { rating: 5, title: "Hi there", body: "short" }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ReviewApiError);
    expect(error).toMatchObject({ status: 400, fieldErrors: { body: ["Review must be at least 20 characters"] } });
  });

  it("treats 204 from DELETE as success", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteReview("curry", "r1")).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "DELETE" });
  });
});
