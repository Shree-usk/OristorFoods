// tests/unit/recipe-bookmark-merge-sync.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

const { RecipeBookmarkMergeSync } = await import("@/components/providers/recipe-bookmark-merge-sync");
const { useRecipeBookmarkStore } = await import("@/lib/stores/recipe-bookmark-store");

beforeEach(() => {
  localStorage.clear();
  useRecipeBookmarkStore.setState({ items: [] });
  vi.restoreAllMocks();
});

describe("RecipeBookmarkMergeSync", () => {
  it("merges guest items and clears the store when the session becomes authenticated", async () => {
    useRecipeBookmarkStore.getState().add("r1");
    useRecipeBookmarkStore.getState().add("r2");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = new QueryClient();

    mockUseSession.mockReturnValue({ status: "unauthenticated" });
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <RecipeBookmarkMergeSync />
      </QueryClientProvider>,
    );

    mockUseSession.mockReturnValue({ status: "authenticated" });
    rerender(
      <QueryClientProvider client={queryClient}>
        <RecipeBookmarkMergeSync />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/recipes/bookmarks/merge",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ recipeIds: ["r1", "r2"] }) }),
      ),
    );
    await waitFor(() => expect(useRecipeBookmarkStore.getState().items).toEqual([]));
  });

  it("does not call merge when there are no guest items", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockUseSession.mockReturnValue({ status: "authenticated" });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <RecipeBookmarkMergeSync />
      </QueryClientProvider>,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
