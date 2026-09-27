// tests/unit/use-recipe-bookmark.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { useRecipeBookmarkStore } from "@/lib/stores/recipe-bookmark-store";

const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

const { useRecipeBookmark } = await import("@/hooks/use-recipe-bookmark");

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  localStorage.clear();
  useRecipeBookmarkStore.setState({ items: [] });
  vi.restoreAllMocks();
});

describe("useRecipeBookmark — guest", () => {
  beforeEach(() => mockUseSession.mockReturnValue({ status: "unauthenticated" }));

  it("is available and starts un-bookmarked", () => {
    const { result } = renderHook(() => useRecipeBookmark("r1", "recipe-one"), { wrapper });
    expect(result.current.isAvailable).toBe(true);
    expect(result.current.isBookmarked).toBe(false);
  });

  it("toggling adds to the guest store", () => {
    const { result } = renderHook(() => useRecipeBookmark("r1", "recipe-one"), { wrapper });
    act(() => result.current.toggle());
    expect(useRecipeBookmarkStore.getState().items).toEqual(["r1"]);
  });

  it("toggling again removes from the guest store", () => {
    useRecipeBookmarkStore.getState().add("r1");
    const { result } = renderHook(() => useRecipeBookmark("r1", "recipe-one"), { wrapper });
    act(() => result.current.toggle());
    expect(useRecipeBookmarkStore.getState().items).toEqual([]);
  });
});

describe("useRecipeBookmark — authenticated", () => {
  beforeEach(() => mockUseSession.mockReturnValue({ status: "authenticated" }));

  it("reflects server bookmark state from GET /api/recipes/bookmarks", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [{ id: "r1" }] }) }));

    const { result } = renderHook(() => useRecipeBookmark("r1", "recipe-one"), { wrapper });

    await waitFor(() => expect(result.current.isBookmarked).toBe(true));
  });

  it("POSTs to the slug-routed endpoint when toggled while not bookmarked", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useRecipeBookmark("r1", "recipe-one"), { wrapper });
    await waitFor(() => expect(result.current.isBookmarked).toBe(false));

    act(() => result.current.toggle());

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/recipes/recipe-one/bookmark", expect.objectContaining({ method: "POST" })),
    );
  });

  it("DELETEs when toggled while already bookmarked", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [{ id: "r1" }] }) });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useRecipeBookmark("r1", "recipe-one"), { wrapper });
    await waitFor(() => expect(result.current.isBookmarked).toBe(true));

    act(() => result.current.toggle());

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/recipes/recipe-one/bookmark", expect.objectContaining({ method: "DELETE" })),
    );
  });

  it("flips isBookmarked optimistically, before the POST resolves", async () => {
    let releasePost: () => void = () => {};
    const postGate = new Promise<void>((resolve) => {
      releasePost = resolve;
    });
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        await postGate;
        return { ok: true, status: 200, json: () => Promise.resolve({}) };
      }
      return { ok: true, status: 200, json: () => Promise.resolve({ items: [] }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useRecipeBookmark("r1", "recipe-one"), { wrapper });
    await waitFor(() => expect(result.current.isBookmarked).toBe(false));

    act(() => result.current.toggle());

    await waitFor(() => expect(result.current.isBookmarked).toBe(true));

    await act(async () => {
      releasePost();
    });
  });

  it("rolls back the optimistic change when the request fails", async () => {
    let releaseDelete: () => void = () => {};
    const deleteGate = new Promise<void>((resolve) => {
      releaseDelete = resolve;
    });
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        await deleteGate;
        return { ok: false, status: 500, json: () => Promise.resolve({}) };
      }
      return { ok: true, status: 200, json: () => Promise.resolve({ items: [{ id: "r1" }] }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useRecipeBookmark("r1", "recipe-one"), { wrapper });
    await waitFor(() => expect(result.current.isBookmarked).toBe(true));

    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.isBookmarked).toBe(false));

    await act(async () => {
      releaseDelete();
    });

    await waitFor(() => expect(result.current.isBookmarked).toBe(true));
  });
});
