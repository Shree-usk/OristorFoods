import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchSuggestionsDropdown } from "@/components/storefront/search/search-suggestions";
import type { SearchSuggestionItem } from "@/services/search-extensions";

const items: SearchSuggestionItem[] = [
  { id: "p1", label: "Roasted Curry Powder", href: "/products/roasted-curry-powder", type: "Product" },
  { id: "p2", label: "Chilli Powder", href: "/products/chilli-powder", type: "Product" },
];

describe("SearchSuggestionsDropdown", () => {
  it("shows recent searches when there is no query and history exists", () => {
    render(
      <SearchSuggestionsDropdown
        hasQuery={false}
        items={[]}
        activeIndex={-1}
        recentSearches={["curry"]}
        onSelectItem={vi.fn()}
        onSelectRecent={vi.fn()}
      />,
    );

    expect(screen.getByText("Recent searches")).toBeVisible();
    expect(screen.getByRole("button", { name: "curry" })).toBeVisible();
  });

  it("shows a hint instead of a blank overlay when there is no query and no history", () => {
    render(
      <SearchSuggestionsDropdown
        hasQuery={false}
        items={[]}
        activeIndex={-1}
        recentSearches={[]}
        onSelectItem={vi.fn()}
        onSelectRecent={vi.fn()}
      />,
    );

    expect(screen.getByText(/Try:/)).toBeVisible();
  });

  it("groups suggestions under a Products heading and omits an empty Recipes heading", () => {
    render(
      <SearchSuggestionsDropdown
        hasQuery
        items={items}
        activeIndex={-1}
        recentSearches={[]}
        onSelectItem={vi.fn()}
        onSelectRecent={vi.fn()}
      />,
    );

    expect(screen.getByText("Products")).toBeVisible();
    expect(screen.getByRole("link", { name: "Roasted Curry Powder" })).toBeVisible();
    expect(screen.queryByText("Recipes")).not.toBeInTheDocument();
  });

  it("marks the item at activeIndex as selected", () => {
    render(
      <SearchSuggestionsDropdown
        hasQuery
        items={items}
        activeIndex={1}
        recentSearches={[]}
        onSelectItem={vi.fn()}
        onSelectRecent={vi.fn()}
      />,
    );

    expect(screen.getByRole("option", { name: "Chilli Powder" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "Roasted Curry Powder" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("calls onSelectItem when a suggestion is clicked", async () => {
    const user = userEvent.setup();
    const onSelectItem = vi.fn();
    render(
      <SearchSuggestionsDropdown
        hasQuery
        items={items}
        activeIndex={-1}
        recentSearches={[]}
        onSelectItem={onSelectItem}
        onSelectRecent={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("link", { name: "Roasted Curry Powder" }));

    expect(onSelectItem).toHaveBeenCalledWith(items[0]);
  });

  it("calls onSelectRecent when a recent search is clicked", async () => {
    const user = userEvent.setup();
    const onSelectRecent = vi.fn();
    render(
      <SearchSuggestionsDropdown
        hasQuery={false}
        items={[]}
        activeIndex={-1}
        recentSearches={["curry"]}
        onSelectItem={vi.fn()}
        onSelectRecent={onSelectRecent}
      />,
    );

    await user.click(screen.getByRole("button", { name: "curry" }));

    expect(onSelectRecent).toHaveBeenCalledWith("curry");
  });

  it("shows a no-matches message when the query has no results", () => {
    render(
      <SearchSuggestionsDropdown
        hasQuery
        items={[]}
        activeIndex={-1}
        recentSearches={[]}
        onSelectItem={vi.fn()}
        onSelectRecent={vi.fn()}
      />,
    );

    expect(screen.getByText(/No matches yet/)).toBeVisible();
  });
});
