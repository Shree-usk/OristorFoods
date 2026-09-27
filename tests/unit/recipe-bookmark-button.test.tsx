// tests/unit/recipe-bookmark-button.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRecipeBookmarkStore } from "@/lib/stores/recipe-bookmark-store";

const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

const { RecipeBookmarkButton } = await import("@/components/storefront/recipes/recipe-bookmark-button");

function renderButton(variant?: "icon" | "labelled") {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <RecipeBookmarkButton recipeId="r1" recipeSlug="recipe-one" variant={variant} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  useRecipeBookmarkStore.setState({ items: [] });
  vi.restoreAllMocks();
  mockUseSession.mockReturnValue({ status: "unauthenticated" });
});

describe("RecipeBookmarkButton", () => {
  it("renders an aria-pressed button with the un-bookmarked label by default", () => {
    renderButton();
    const button = screen.getByRole("button", { name: "Bookmark this recipe" });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("toggling flips the label and aria-pressed state (guest path)", async () => {
    renderButton();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Bookmark this recipe" }));

    expect(screen.getByRole("button", { name: "Remove bookmark" })).toHaveAttribute("aria-pressed", "true");
  });

  it("labelled variant renders visible text, not only an aria-label", () => {
    renderButton("labelled");
    expect(screen.getByText("Bookmark this recipe")).toBeInTheDocument();
  });
});
