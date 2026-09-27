import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { RelatedRecipes } from "@/components/storefront/recipes/related-recipes";

const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({ useSession: () => mockUseSession() }));

beforeEach(() => {
  mockUseSession.mockReturnValue({ status: "unauthenticated" });
});

function renderRelated(ui: ReactElement) {
  const queryClient = new QueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("RelatedRecipes", () => {
  it("renders nothing when there are no related recipes", () => {
    const { container } = renderRelated(<RelatedRecipes recipes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a RecipeCard per related recipe", () => {
    renderRelated(
      <RelatedRecipes
        recipes={[
          { id: "r1", slug: "r1", href: "/recipes/r1", title: "R1", heroImage: "/a.webp", heroImageAlt: "a", categoryName: "Curries", cuisine: null, difficulty: "Easy", totalTimeMinutes: 30, avgRating: null, ratingCount: 0, dietaryTags: [], hasVideo: false },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "R1" })).toBeInTheDocument();
  });
});
