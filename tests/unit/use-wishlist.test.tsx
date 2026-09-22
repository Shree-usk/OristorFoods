import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { useWishlistStore } from "@/lib/stores/wishlist-store";

const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

const { useWishlist } = await import("@/hooks/use-wishlist");

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  localStorage.clear();
  useWishlistStore.setState({ items: [] });
  vi.restoreAllMocks();
});

describe("useWishlist — guest", () => {
  beforeEach(() => mockUseSession.mockReturnValue({ status: "unauthenticated" }));

  it("is available and starts un-wishlisted", () => {
    const { result } = renderHook(() => useWishlist("p1"), { wrapper });

    expect(result.current.isAvailable).toBe(true);
    expect(result.current.isWishlisted).toBe(false);
  });

  it("toggling adds to the guest store", () => {
    const { result } = renderHook(() => useWishlist("p1"), { wrapper });

    act(() => result.current.toggle());

    expect(useWishlistStore.getState().items).toEqual(["p1"]);
  });

  it("toggling again removes from the guest store", () => {
    useWishlistStore.getState().add("p1");
    const { result } = renderHook(() => useWishlist("p1"), { wrapper });

    act(() => result.current.toggle());

    expect(useWishlistStore.getState().items).toEqual([]);
  });
});

describe("useWishlist — authenticated", () => {
  beforeEach(() => mockUseSession.mockReturnValue({ status: "authenticated" }));

  it("reflects server wishlist state from GET /api/wishlist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [{ id: "p1" }] }) }),
    );

    const { result } = renderHook(() => useWishlist("p1"), { wrapper });

    await waitFor(() => expect(result.current.isWishlisted).toBe(true));
  });

  it("POSTs to add when toggled while not wishlisted", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useWishlist("p1"), { wrapper });
    await waitFor(() => expect(result.current.isWishlisted).toBe(false));

    act(() => result.current.toggle());

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/wishlist", expect.objectContaining({ method: "POST" })),
    );
  });

  it("DELETEs when toggled while already wishlisted", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [{ id: "p1" }] }) });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useWishlist("p1"), { wrapper });
    await waitFor(() => expect(result.current.isWishlisted).toBe(true));

    act(() => result.current.toggle());

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/wishlist/p1", expect.objectContaining({ method: "DELETE" })),
    );
  });
});
