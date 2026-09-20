import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SearchOverlay } from "@/components/storefront/search/search-overlay";
import { useRecentSearchesStore } from "@/lib/stores/recent-searches-store";
import type { SearchResultsPage } from "@/services/search.service";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const suggestionsResponse: SearchResultsPage = {
  query: "curry",
  products: [
    {
      id: "p1",
      name: "Roasted Curry Powder",
      href: "/products/roasted-curry-powder",
      imageSrc: "",
      imageAlt: "Roasted Curry Powder",
      price: 450,
      currency: "LKR",
      inStock: true,
    } as unknown as SearchResultsPage["products"][number],
  ],
  recipes: [],
  page: 1,
  pageSize: 5,
  hasNextPage: false,
};

function renderOverlay() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <SearchOverlay />
    </QueryClientProvider>,
  );
}

describe("SearchOverlay", () => {
  beforeEach(() => {
    localStorage.clear();
    useRecentSearchesStore.setState({ queries: [] });
    mockPush.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(suggestionsResponse) }),
    );
  });

  it("opens the overlay when the trigger is clicked", async () => {
    const user = userEvent.setup();
    renderOverlay();

    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("shows a hint (not a blank overlay) when opened with no query and no history", async () => {
    const user = userEvent.setup();
    renderOverlay();

    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(screen.getByText(/Try:/)).toBeVisible();
  });

  it("shows live suggestions grouped by type after typing", async () => {
    const user = userEvent.setup();
    renderOverlay();
    await user.click(screen.getByRole("button", { name: "Search" }));

    // Scoped to the dialog: the now-inert background trigger button also
    // carries aria-label="Search" and stays in the DOM (just aria-hidden),
    // so an unscoped getByLabelText would match both it and the input.
    await user.type(within(screen.getByRole("dialog")).getByLabelText("Search"), "curry");

    await waitFor(() => expect(screen.getByText("Roasted Curry Powder")).toBeVisible());
    expect(screen.getByText("Products")).toBeVisible();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    renderOverlay();
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByRole("dialog")).toBeVisible();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("navigates to the results page and records the query on submit", async () => {
    const user = userEvent.setup();
    renderOverlay();
    await user.click(screen.getByRole("button", { name: "Search" }));

    await user.type(within(screen.getByRole("dialog")).getByLabelText("Search"), "curry{Enter}");

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/search?q=curry"));
    expect(useRecentSearchesStore.getState().queries).toContain("curry");
  });
});
