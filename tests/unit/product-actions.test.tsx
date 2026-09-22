import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: "unauthenticated" }),
}));

const { ProductActions } = await import("@/components/storefront/product/product-actions");
const { useWishlistStore } = await import("@/lib/stores/wishlist-store");
const { useCompareStore } = await import("@/lib/stores/compare-store");

function renderWithProviders(ui: React.ReactElement) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  localStorage.clear();
  useWishlistStore.setState({ items: [] });
  useCompareStore.setState({ items: [] });
});

describe("ProductActions", () => {
  it("shows an Out of Stock label and disables Add to Cart when out of stock", () => {
    renderWithProviders(<ProductActions productId="p1" inStock={false} />);

    expect(screen.getByRole("button", { name: "Out of Stock" })).toBeDisabled();
  });

  it("enables the wishlist toggle now that STORY-013 provides a real implementation", () => {
    renderWithProviders(<ProductActions productId="p1" inStock={true} />);

    expect(screen.getByRole("button", { name: "Add to wishlist" })).toBeEnabled();
  });

  it("toggles the wishlist button's pressed state on click", async () => {
    renderWithProviders(<ProductActions productId="p1" inStock={true} />);

    const button = screen.getByRole("button", { name: "Add to wishlist" });
    button.click();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Remove from wishlist" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
  });

  it("disables Add to Cart even when in stock, until STORY-024 provides a real implementation", () => {
    renderWithProviders(<ProductActions productId="p1" inStock={true} />);

    expect(screen.getByRole("button", { name: "Add to Cart" })).toBeDisabled();
  });

  it("renders a compare toggle that adds the product to the compare store", () => {
    renderWithProviders(<ProductActions productId="p1" inStock={true} />);

    screen.getByRole("button", { name: "Add to compare" }).click();

    expect(useCompareStore.getState().items).toEqual(["p1"]);
  });
});
