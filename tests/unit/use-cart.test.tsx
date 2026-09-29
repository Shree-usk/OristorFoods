// tests/unit/use-cart.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCart } from "@/hooks/use-cart";
import type { CartSummary } from "@/types/cart";

const emptyCart: CartSummary = { items: [], itemCount: 0, subtotal: 0, currency: "LKR", rewardPointsEarned: 0, discount: null, couponCode: null, couponInvalidReason: null, pointsBalance: 0, pointsRedemption: null };

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

  it("addItem surfaces the server's error message when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/cart") return Promise.resolve(new Response(JSON.stringify(emptyCart), { status: 200, headers: { "Content-Type": "application/json" } }));
        return Promise.resolve(
          new Response(JSON.stringify({ error: "Only 2 left in stock", availableQuantity: 2 }), { status: 409, headers: { "Content-Type": "application/json" } }),
        );
      }),
    );

    const { result } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.cart).toBeDefined());

    result.current.addItem("product-1", 5);

    await waitFor(() => expect(result.current.addItemError).toBe("Only 2 left in stock"));
  });

  it("exposes isUpdatingItemId while a quantity update for that item is in flight", async () => {
    let resolvePatch!: (value: Response) => void;
    const patchPromise = new Promise<Response>((resolve) => {
      resolvePatch = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (init?.method === "PATCH") return patchPromise;
        return Promise.resolve(new Response(JSON.stringify(emptyCart), { status: 200, headers: { "Content-Type": "application/json" } }));
      }),
    );

    const { result } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.cart).toBeDefined());

    result.current.updateQuantity("item-1", 3);

    await waitFor(() => expect(result.current.isUpdatingItemId).toBe("item-1"));

    resolvePatch(new Response(null, { status: 200 }));
    await waitFor(() => expect(result.current.isUpdatingItemId).toBeUndefined());
  });
});
