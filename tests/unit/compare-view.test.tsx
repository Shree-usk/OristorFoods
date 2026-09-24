import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompareItem } from "@/services/product.service";

// CompareView calls `useRouter()` unconditionally (to `router.replace()` after
// a remove). jsdom has no Next.js app router mounted in these component
// tests, so — matching the existing pattern in
// tests/unit/search-overlay.test.tsx — mock next/navigation locally rather
// than rendering under a real router.
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const { CompareView } = await import("@/components/storefront/product/compare-view");
const { useCompareStore } = await import("@/lib/stores/compare-store");

const itemA: CompareItem = {
  id: "p1",
  slug: "curry-powder",
  name: "Curry Powder",
  imageSrc: "/curry.jpg",
  imageAlt: "Curry Powder",
  brandName: "Oristor",
  price: 450,
  currency: "LKR",
  nutrition: {
    servingSize: "1 tsp",
    calories: 10,
    protein: 1,
    fat: 0.5,
    saturatedFat: 0.1,
    carbohydrates: 1,
    sugar: 0.2,
    fibre: 0.5,
    sodium: 1,
  },
  ingredients: [{ name: "Coriander", isAllergen: false }],
  allergenNames: [],
  certificationNames: ["Organic"],
  rating: 4.5,
  reviewCount: 10,
};

const itemB: CompareItem = { ...itemA, id: "p2", slug: "chili-paste", name: "Chili Paste" };

function renderView(items: CompareItem[]) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <CompareView items={items} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useCompareStore.setState({ items: [] });
});

describe("CompareView", () => {
  it("shows an empty state with zero products", () => {
    renderView([]);

    expect(screen.getByText(/add more products to compare/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse products/i })).toHaveAttribute("href", "/products");
  });

  it("shows an empty state with only one product", () => {
    renderView([itemA]);

    expect(screen.getByText(/add more products to compare/i)).toBeInTheDocument();
  });

  it("renders each product's name, price, and key attributes with 2+ products", () => {
    renderView([itemA, itemB]);

    expect(screen.getByText("Curry Powder")).toBeInTheDocument();
    expect(screen.getByText("Chili Paste")).toBeInTheDocument();
    expect(screen.getAllByText("LKR 450")).toHaveLength(2);
    expect(screen.getAllByText("Organic")).toHaveLength(2);
  });

  it("removing a product drops it from the view and from the compare store", async () => {
    useCompareStore.setState({ items: ["p1", "p2"] });
    renderView([itemA, itemB]);

    screen.getByRole("button", { name: /remove curry powder/i }).click();

    await waitFor(() => expect(screen.queryByText("Curry Powder")).not.toBeInTheDocument());
    expect(useCompareStore.getState().items).toEqual(["p2"]);
  });
});
