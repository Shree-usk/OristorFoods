import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import type { RecipeCard } from "@/types/recipe";

vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/services/recipe.service", () => ({ getFeaturedRecipes: vi.fn() }));

const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({ useSession: () => mockUseSession() }));

import { FeaturedRecipes } from "@/components/storefront/home/featured-recipes";
import { getFeaturedRecipes } from "@/services/recipe.service";

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function card(slug: string, title: string): RecipeCard {
  return {
    id: slug,
    slug,
    href: `/recipes/${slug}`,
    title,
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: `${title} image`,
    categoryName: "Curries",
    cuisine: "Sri Lankan",
    difficulty: "Easy",
    totalTimeMinutes: 30,
    avgRating: null,
    ratingCount: 0,
    dietaryTags: [],
    hasVideo: false,
  };
}

beforeEach(() => {
  vi.mocked(getFeaturedRecipes).mockReset();
  mockUseSession.mockReturnValue({ status: "unauthenticated" });
});

describe("FeaturedRecipes", () => {
  it("renders the featured recipes as cards linking to their pages", async () => {
    vi.mocked(getFeaturedRecipes).mockResolvedValue([card("dhal-curry", "Dhal Curry"), card("seeni-sambol", "Seeni Sambol")]);

    renderWithProviders(await FeaturedRecipes());

    expect(getFeaturedRecipes).toHaveBeenCalledWith(4);
    expect(screen.getByRole("heading", { level: 2, name: "Featured Recipes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dhal Curry" })).toHaveAttribute("href", "/recipes/dhal-curry");
    expect(screen.getByRole("link", { name: "View all recipes" })).toHaveAttribute("href", "/recipes");
  });

  it("renders nothing when no recipe is featured", async () => {
    vi.mocked(getFeaturedRecipes).mockResolvedValue([]);

    expect(await FeaturedRecipes()).toBeNull();
  });
});
