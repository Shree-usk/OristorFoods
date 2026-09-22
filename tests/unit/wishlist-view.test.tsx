import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductListItem } from "@/types/product";

const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

const { WishlistView } = await import("@/components/storefront/account/wishlist-view");
const { useWishlistStore } = await import("@/lib/stores/wishlist-store");

const item: ProductListItem = {
  id: "p1",
  name: "Curry Powder",
  href: "/products/curry-powder",
  imageSrc: "/images/curry-powder.jpg",
  imageAlt: "Curry Powder",
  price: 450,
  currency: "LKR",
  inStock: true,
};

function renderView() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <WishlistView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  useWishlistStore.setState({ items: [] });
  vi.restoreAllMocks();
});

describe("WishlistView — guest", () => {
  beforeEach(() => mockUseSession.mockReturnValue({ status: "unauthenticated" }));

  it("shows an empty state with no guest items", () => {
    renderView();

    expect(screen.getByText(/wishlist is empty/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse products/i })).toHaveAttribute("href", "/products");
  });

  it("fetches and renders guest items by id", async () => {
    useWishlistStore.getState().add("p1");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [item] }) }),
    );

    renderView();

    await waitFor(() => expect(screen.getByText("Curry Powder")).toBeInTheDocument());
  });

  it("removing an item calls the guest store's remove", async () => {
    useWishlistStore.getState().add("p1");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [item] }) }),
    );

    renderView();
    await waitFor(() => expect(screen.getByText("Curry Powder")).toBeInTheDocument());
    screen.getByRole("button", { name: /remove/i }).click();

    expect(useWishlistStore.getState().items).toEqual([]);
  });
});

describe("WishlistView — authenticated", () => {
  beforeEach(() => mockUseSession.mockReturnValue({ status: "authenticated" }));

  it("fetches and renders server-side items", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [item] }) }),
    );

    renderView();

    await waitFor(() => expect(screen.getByText("Curry Powder")).toBeInTheDocument());
    expect(screen.getByText("LKR 450")).toBeInTheDocument();
  });

  it("shows a disabled 'Move all to cart' button (cart not built yet)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [item] }) }),
    );

    renderView();

    await waitFor(() => expect(screen.getByText("Curry Powder")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /move all to cart/i })).toBeDisabled();
  });
});
