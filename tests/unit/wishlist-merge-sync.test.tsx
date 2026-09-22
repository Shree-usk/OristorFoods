import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

const { WishlistMergeSync } = await import("@/components/providers/wishlist-merge-sync");
const { useWishlistStore } = await import("@/lib/stores/wishlist-store");

beforeEach(() => {
  localStorage.clear();
  useWishlistStore.setState({ items: [] });
  vi.restoreAllMocks();
});

describe("WishlistMergeSync", () => {
  it("merges guest items and clears the store when the session becomes authenticated", async () => {
    useWishlistStore.getState().add("p1");
    useWishlistStore.getState().add("p2");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = new QueryClient();

    mockUseSession.mockReturnValue({ status: "unauthenticated" });
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <WishlistMergeSync />
      </QueryClientProvider>,
    );

    mockUseSession.mockReturnValue({ status: "authenticated" });
    rerender(
      <QueryClientProvider client={queryClient}>
        <WishlistMergeSync />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/wishlist/merge",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ productIds: ["p1", "p2"] }) }),
      ),
    );
    await waitFor(() => expect(useWishlistStore.getState().items).toEqual([]));
  });

  it("does not call merge when there are no guest items", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockUseSession.mockReturnValue({ status: "authenticated" });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <WishlistMergeSync />
      </QueryClientProvider>,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call merge while already authenticated on mount then re-rendering", () => {
    useWishlistStore.getState().add("p1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockUseSession.mockReturnValue({ status: "authenticated" });
    const queryClient = new QueryClient();

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <WishlistMergeSync />
      </QueryClientProvider>,
    );
    rerender(
      <QueryClientProvider client={queryClient}>
        <WishlistMergeSync />
      </QueryClientProvider>,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
