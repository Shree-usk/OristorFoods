// tests/unit/cart-page.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CartPage from "@/app/(storefront)/cart/page";
import type { CartSummary } from "@/types/cart";

const cartWithItem: CartSummary = {
  items: [
    {
      id: "item-1",
      productId: "p1",
      productName: "Roasted Curry Powder 100g",
      productSlug: "roasted-curry-powder-100g",
      imageSrc: "/images/products/export/curry-powder.webp",
      imageAlt: "Roasted Curry Powder",
      quantity: 1,
      unitPrice: 25,
      currency: "LKR",
      lineTotal: 25,
      rewardPointsEarned: 5,
      priceChanged: false,
      unavailable: false,
      quantityCapped: false,
      availableQuantity: 10,
    },
  ],
  itemCount: 1,
  subtotal: 25,
  currency: "LKR",
  rewardPointsEarned: 5,
  discount: null,
  couponCode: null,
  couponInvalidReason: null,
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CartPage />
    </QueryClientProvider>,
  );
}

describe("CartPage", () => {
  it("announces the removed product name via an aria-live region", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(cartWithItem), { status: 200, headers: { "Content-Type": "application/json" } })),
    );

    renderPage();

    await waitFor(() => expect(screen.getByText("Roasted Curry Powder 100g")).toBeInTheDocument());
    screen.getByRole("button", { name: /remove roasted curry powder 100g/i }).click();

    await waitFor(() => {
      expect(screen.getByText(/removed roasted curry powder 100g from cart/i)).toBeInTheDocument();
    });
  });
});
