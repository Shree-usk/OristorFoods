// tests/unit/use-cart.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCart } from "@/hooks/use-cart";
import type { CartSummary } from "@/types/cart";

const emptyCart: CartSummary = { items: [], itemCount: 0, subtotal: 0, currency: "LKR", rewardPointsEarned: 0 };

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(emptyCart), { status: 200, headers: { "Content-Type": "application/json" } })),
  );
});

describe("useCart", () => {
  it("fetches the current cart from GET /api/cart", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await waitFor(() => expect(result.current.cart).toBeDefined());
    expect(result.current.cart).toEqual(emptyCart);
    expect(fetch).toHaveBeenCalledWith("/api/cart", expect.anything());
  });

  it("addItem POSTs to /api/cart/items and invalidates the cart query", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.cart).toBeDefined());

    result.current.addItem("product-1", 2);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/cart/items",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ productId: "product-1", quantity: 2 }) }),
      );
    });
  });
});
