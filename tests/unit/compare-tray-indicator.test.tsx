import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { CompareTrayIndicator } = await import("@/components/storefront/layout/compare-tray-indicator");
const { useCompareStore } = await import("@/lib/stores/compare-store");

function renderIndicator() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <CompareTrayIndicator />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useCompareStore.setState({ items: [] });
  vi.restoreAllMocks();
});

describe("CompareTrayIndicator", () => {
  it("shows no count badge when the tray is empty", () => {
    renderIndicator();

    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows the item count when the tray has products", () => {
    useCompareStore.setState({ items: ["p1", "p2"] });

    renderIndicator();

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("opens the drawer and shows an empty-state message with no items", async () => {
    renderIndicator();

    screen.getByRole("button", { name: /compare/i }).click();

    await waitFor(() => expect(screen.getByText(/add products to compare/i)).toBeInTheDocument());
  });

  it("opens the drawer and fetches thumbnails for tray items", async () => {
    useCompareStore.setState({ items: ["p1"] });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                id: "p1",
                name: "Curry Powder",
                href: "/products/curry-powder",
                imageSrc: "/curry.jpg",
                imageAlt: "Curry Powder",
                price: 450,
                currency: "LKR",
                inStock: true,
              },
            ],
          }),
      }),
    );

    renderIndicator();
    screen.getByRole("button", { name: /compare/i }).click();

    await waitFor(() => expect(screen.getByText("Curry Powder")).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith("/api/products/by-ids?ids=p1");
  });

  it("removing an item from the drawer updates the compare store", async () => {
    useCompareStore.setState({ items: ["p1"] });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                id: "p1",
                name: "Curry Powder",
                href: "/products/curry-powder",
                imageSrc: "/curry.jpg",
                imageAlt: "Curry Powder",
                price: 450,
                currency: "LKR",
                inStock: true,
              },
            ],
          }),
      }),
    );

    renderIndicator();
    screen.getByRole("button", { name: /compare/i }).click();
    await waitFor(() => expect(screen.getByText("Curry Powder")).toBeInTheDocument());

    screen.getByRole("button", { name: /remove curry powder/i }).click();

    expect(useCompareStore.getState().items).toEqual([]);
  });
});
