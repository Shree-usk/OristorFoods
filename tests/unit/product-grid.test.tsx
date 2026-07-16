import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProductGrid } from "@/components/storefront/product/product-grid";
import type { ProductListingResult } from "@/services/product.service";

const initialData: ProductListingResult = {
  items: [
    {
      id: "1",
      name: "Curry Powder",
      href: "/products/curry-powder",
      imageSrc: "/images/curry-powder.jpg",
      imageAlt: "Curry Powder",
      price: 650,
      currency: "LKR",
      inStock: true,
    },
  ],
  total: 1,
  page: 1,
  pageSize: 24,
  hasNextPage: false,
};

function renderProductGrid(data: ProductListingResult) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ProductGrid
        scope={{}}
        initialData={data}
        allergenOptions={[]}
        certificationOptions={[]}
        brandOptions={[]}
      />
    </QueryClientProvider>,
    { wrapper: withNuqsTestingAdapter() },
  );
}

describe("ProductGrid", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(initialData) }),
    );
  });

  it("renders products from initialData immediately", () => {
    renderProductGrid(initialData);
    expect(screen.getByText("Curry Powder")).toBeInTheDocument();
  });

  it("renders a zero-result state with a clear-filters control when the API returns no items", async () => {
    const empty: ProductListingResult = { items: [], total: 0, page: 1, pageSize: 24, hasNextPage: false };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(empty) }));

    renderProductGrid(empty);

    await waitFor(() => {
      expect(screen.getByText("No products match your filters.")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Clear all filters" })).toBeInTheDocument();
  });

  it("renders pagination reflecting the current result", () => {
    renderProductGrid({ ...initialData, total: 50, pageSize: 24 });
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
  });
});
