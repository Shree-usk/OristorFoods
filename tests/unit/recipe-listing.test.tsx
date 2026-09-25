import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecipeListing } from "@/components/storefront/recipes/recipe-listing";
import type { RecipeCard, RecipeFacets, RecipeListResult } from "@/types/recipe";

function card(id: string, title: string): RecipeCard {
  return {
    id,
    slug: id,
    href: `/recipes/${id}`,
    title,
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: `${title} image`,
    categoryName: "Curries",
    cuisine: null,
    difficulty: "Easy",
    totalTimeMinutes: 30,
    avgRating: null,
    ratingCount: 0,
    dietaryTags: [],
  };
}

const initialData: RecipeListResult = { recipes: [card("dhal", "Dhal Curry"), card("kottu", "Chicken Kottu Roti")], total: 2, page: 1, pageSize: 12 };
const facets: RecipeFacets = {
  categories: [{ name: "Curries", slug: "curries" }],
  dietaryTags: [{ name: "Vegan", slug: "vegan" }],
};

function renderListing(data: RecipeListResult = initialData, searchParams = "") {
  const onUrlUpdate = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RecipeListing initialData={data} facets={facets} />
    </QueryClientProvider>,
    { wrapper: withNuqsTestingAdapter({ searchParams, hasMemory: true, onUrlUpdate }) },
  );
  return { onUrlUpdate };
}

function respondWith(body: RecipeListResult) {
  return vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) });
}

beforeEach(() => {
  vi.stubGlobal("fetch", respondWith(initialData));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RecipeListing", () => {
  it("renders the server-provided recipes and count without fetching", () => {
    renderListing();

    expect(screen.getByRole("link", { name: "Dhal Curry" })).toBeInTheDocument();
    expect(screen.getByText("2 recipes")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Recipe results" })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refetches with the new filter and resets to page 1", async () => {
    const user = userEvent.setup();
    const filtered: RecipeListResult = { ...initialData, recipes: [card("dhal", "Dhal Curry")], total: 1 };
    vi.stubGlobal("fetch", respondWith(filtered));
    const { onUrlUpdate } = renderListing(initialData, "?page=2");

    await user.click(screen.getByRole("checkbox", { name: "Easy" }));

    await waitFor(() => expect(screen.getByText("1 recipe")).toBeInTheDocument());
    expect(vi.mocked(fetch).mock.calls.at(-1)?.[0]).toContain("difficulty=easy");
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].queryString).toBe("?difficulty=easy");
  });

  it("selects a category chip in place and builds real hrefs", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderListing();

    expect(screen.getByRole("link", { name: "Curries" })).toHaveAttribute("href", "/recipes?category=curries");
    await user.click(screen.getByRole("link", { name: "Curries" }));

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].queryString).toBe("?category=curries");
  });

  it("shows the empty state and clears every filter but keeps the sort", async () => {
    const user = userEvent.setup();
    const empty: RecipeListResult = { recipes: [], total: 0, page: 1, pageSize: 12 };
    const { onUrlUpdate } = renderListing(empty, "?category=beverages&diet=spicy&sort=time");

    expect(screen.getByText("No recipes match those filters.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].queryString).toBe("?sort=time");
  });

  it("offers a way back when the page is past the end", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderListing({ recipes: [], total: 16, page: 9, pageSize: 12 }, "?page=9");

    expect(screen.getByText("There are no recipes on this page.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Go to first page" }));

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].queryString).toBe("");
  });

  it("keeps the previous results and shows a retry alert when a refetch fails", async () => {
    const user = userEvent.setup();
    const failing = vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    vi.stubGlobal("fetch", failing);
    renderListing();

    await user.click(screen.getByRole("checkbox", { name: "Easy" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't update recipes.");
    expect(screen.getByRole("link", { name: "Dhal Curry" })).toBeInTheDocument();

    const callsBefore = failing.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(failing.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("debounces search before fetching and replaces rather than pushes history", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderListing();

    await user.type(screen.getByRole("searchbox", { name: "Search recipes" }), "dhal");

    expect(onUrlUpdate.mock.calls.at(-1)?.[0].options.history).toBe("replace");
    // On a slow runner, keystrokes can land >300ms apart, so an intermediate
    // debounced fetch fires first; the default 1s waitFor then expires before
    // the final one settles.
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.at(-1)?.[0]).toContain("q=dhal"), { timeout: 3000 });
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes("q=d&")).length).toBe(0);
  });
});
