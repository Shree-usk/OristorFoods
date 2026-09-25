import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RecipeCategoryChips } from "@/components/storefront/recipes/recipe-category-chips";
import { RecipeEmptyState } from "@/components/storefront/recipes/recipe-empty-state";
import { RecipeFilterControls, type RecipeFilterValues } from "@/components/storefront/recipes/recipe-filter-controls";
import { RecipeSearchBox } from "@/components/storefront/recipes/recipe-search-box";
import { RecipeSortSelect } from "@/components/storefront/recipes/recipe-sort-select";

const categories = [
  { name: "Curries", slug: "curries" },
  { name: "Snacks", slug: "snacks" },
];
const hrefFor = (slug: string | null) => (slug ? `/recipes?category=${slug}` : "/recipes");
const noFilters: RecipeFilterValues = { difficulty: [], time: [], diet: [], hasVideo: false };

describe("RecipeCategoryChips", () => {
  it("renders All plus one link per category, marking the selected one", () => {
    render(<RecipeCategoryChips categories={categories} selected="curries" hrefFor={hrefFor} onSelect={vi.fn()} />);

    const nav = screen.getByRole("navigation", { name: "Recipe categories" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("href", "/recipes");
    expect(screen.getByRole("link", { name: "Curries" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Snacks" })).not.toHaveAttribute("aria-current");
  });

  it("marks All as current when no category is selected", () => {
    render(<RecipeCategoryChips categories={categories} selected={null} hrefFor={hrefFor} onSelect={vi.fn()} />);
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
  });

  it("selects in place on a plain click", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<RecipeCategoryChips categories={categories} selected={null} hrefFor={hrefFor} onSelect={onSelect} />);

    await user.click(screen.getByRole("link", { name: "Snacks" }));
    await user.click(screen.getByRole("link", { name: "All" }));

    expect(onSelect).toHaveBeenNthCalledWith(1, "snacks");
    expect(onSelect).toHaveBeenNthCalledWith(2, null);
  });
});

describe("RecipeFilterControls", () => {
  it("renders the three fieldsets with their options", () => {
    render(
      <RecipeFilterControls values={noFilters} onChange={vi.fn()} onClear={vi.fn()} dietaryTagOptions={[{ name: "Vegan", slug: "vegan" }]} />,
    );

    expect(screen.getByRole("group", { name: "Difficulty" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Time" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Dietary" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "15–30 min" })).toBeInTheDocument();
  });

  it("toggles difficulty, time and diet values", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RecipeFilterControls
        values={{ difficulty: ["easy"], time: [], diet: [], hasVideo: false }}
        onChange={onChange}
        onClear={vi.fn()}
        dietaryTagOptions={[{ name: "Vegan", slug: "vegan" }]}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Easy" }));
    await user.click(screen.getByRole("checkbox", { name: "Under 15 min" }));
    await user.click(screen.getByRole("checkbox", { name: "Vegan" }));

    expect(onChange).toHaveBeenNthCalledWith(1, { difficulty: [], time: [], diet: [], hasVideo: false });
    expect(onChange).toHaveBeenNthCalledWith(2, { difficulty: ["easy"], time: ["under-15"], diet: [], hasVideo: false });
    expect(onChange).toHaveBeenNthCalledWith(3, { difficulty: ["easy"], time: [], diet: ["vegan"], hasVideo: false });
  });

  it("calls onChange with hasVideo true when the Has Video checkbox is checked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RecipeFilterControls values={noFilters} onChange={onChange} onClear={vi.fn()} dietaryTagOptions={[]} />);
    await user.click(screen.getByRole("checkbox", { name: /has video/i }));
    expect(onChange).toHaveBeenCalledWith({ ...noFilters, hasVideo: true });
  });

  it("omits the Dietary fieldset when there are no tags, and clears on request", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<RecipeFilterControls values={noFilters} onChange={vi.fn()} onClear={onClear} dietaryTagOptions={[]} />);

    expect(screen.queryByRole("group", { name: "Dietary" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});

describe("RecipeSearchBox", () => {
  it("reports each change and clears", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<RecipeSearchBox value="" onChange={onChange} />);

    await user.type(screen.getByRole("searchbox", { name: "Search recipes" }), "d");
    expect(onChange).toHaveBeenLastCalledWith("d");
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();

    rerender(<RecipeSearchBox value="dhal" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});

describe("RecipeEmptyState", () => {
  it("shows the message and runs the action", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<RecipeEmptyState message="No recipes match those filters." actionLabel="Clear all filters" onAction={onAction} />);

    expect(screen.getByText("No recipes match those filters.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(onAction).toHaveBeenCalledOnce();
  });
});

describe("RecipeSortSelect", () => {
  it("offers the four recipe sorts", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<RecipeSortSelect value="newest" onValueChange={onValueChange} />);

    await user.click(screen.getByRole("combobox", { name: "Sort recipes" }));
    for (const label of ["Newest", "Most Popular", "Highest Rated", "Cook Time (shortest first)"]) {
      expect(await screen.findByRole("option", { name: label })).toBeInTheDocument();
    }
    await user.click(screen.getByRole("option", { name: "Cook Time (shortest first)" }));
    expect(onValueChange).toHaveBeenCalledWith("time");
  });
});
