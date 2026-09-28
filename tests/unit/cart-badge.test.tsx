// tests/unit/cart-badge.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CartBadge } from "@/components/storefront/layout/cart-badge";
import type { CartSummary } from "@/types/cart";

function renderWithCart(cart: CartSummary) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(cart), { status: 200, headers: { "Content-Type": "application/json" } })));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CartBadge />
    </QueryClientProvider>,
  );
}

describe("CartBadge", () => {
  it("shows no badge for an empty cart", async () => {
    renderWithCart({ items: [], itemCount: 0, subtotal: 0, currency: "LKR", rewardPointsEarned: 0, discount: null, couponCode: null, couponInvalidReason: null });
    expect(await screen.findByRole("link", { name: "Cart" })).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows the item count once the cart loads", async () => {
    renderWithCart({ items: [], itemCount: 3, subtotal: 100, currency: "LKR", rewardPointsEarned: 5, discount: null, couponCode: null, couponInvalidReason: null });
    expect(await screen.findByText("3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cart, 3 items" })).toBeInTheDocument();
  });
});
