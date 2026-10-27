import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductDetailBundle, ProductDetailBundleItem, ProductDetailGiftOffer } from "@/services/product.service";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: "unauthenticated" }),
}));

const { PromotionSelector } = await import("@/components/storefront/product/promotion-selector");
const { VariantSelectionProvider } = await import("@/components/storefront/product/variant-selection-context");
const { useWishlistStore } = await import("@/lib/stores/wishlist-store");
const { useCompareStore } = await import("@/lib/stores/compare-store");
const { useUiStore } = await import("@/lib/stores/use-ui-store");

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <VariantSelectionProvider variants={[]}>{ui}</VariantSelectionProvider>
    </QueryClientProvider>,
  );
}

const baseProps = {
  productId: "p1",
  productName: "Roasted Curry Powder",
  productImageSrc: "/images/products/curry-powder.webp",
  price: 500,
  originalPrice: null,
  currency: "LKR",
  inStock: true,
  rewardPoints: 10,
  shortDescription: "Authentic roasted curry powder.",
  variants: [],
  packagingOptions: [],
  giftOffer: null,
};

function makeBundle(overrides: Partial<ProductDetailBundle> = {}): ProductDetailBundle {
  return {
    id: "bundle-1",
    bundleType: "Fixed",
    name: "Curry Night Bundle",
    description: "Everything for a great curry night.",
    minQuantity: null,
    maxQuantity: null,
    standaloneTotal: 1000,
    discountedTotal: 800,
    currency: "LKR",
    inStock: true,
    ...overrides,
  };
}

function makeBundleItems(): ProductDetailBundleItem[] {
  return [
    {
      bundleItemId: "item-1",
      productId: "p2",
      variantId: null,
      name: "Chili Paste",
      slug: "chili-paste",
      quantity: 1,
      imageSrc: "/images/products/chili-paste.webp",
      imageAlt: "Chili Paste",
      price: 500,
      inStock: true,
      isRequired: true,
      minQuantity: 1,
      maxQuantity: null,
    },
  ];
}

function makeGiftOffer(overrides: Partial<ProductDetailGiftOffer> = {}): ProductDetailGiftOffer {
  return {
    id: "gift-1",
    name: "Free Chili Paste",
    description: "Get a free jar with this purchase.",
    minQuantity: null,
    minSpend: null,
    giftProductName: "Chili Paste",
    giftProductImageSrc: "/images/products/chili-paste.webp",
    giftProductImageAlt: "Chili Paste",
    giftQuantity: 1,
    standaloneValue: 350,
    currency: "LKR",
    inStock: true,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  useWishlistStore.setState({ items: [] });
  useCompareStore.setState({ items: [] });
  useUiStore.setState({ isCartDrawerOpen: false });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));
});

describe("PromotionSelector — no eligible bundle", () => {
  it("renders the regular purchase panel alone, with no selector cards", () => {
    renderWithProviders(<PromotionSelector {...baseProps} bundle={null} bundleItems={[]} />);

    expect(screen.getByRole("button", { name: "Add to Cart" })).toBeInTheDocument();
    expect(screen.queryByText("How would you like to buy this?")).not.toBeInTheDocument();
  });
});

describe("PromotionSelector — eligible bundle present", () => {
  it("defaults to the regular purchase option, showing exactly one Add to Cart control", () => {
    renderWithProviders(<PromotionSelector {...baseProps} bundle={makeBundle()} bundleItems={makeBundleItems()} />);

    expect(screen.getByRole("button", { name: "Add to Cart" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add bundle to cart" })).not.toBeInTheDocument();
  });

  it("shows both options as pressable cards, with the regular option pressed by default", () => {
    renderWithProviders(<PromotionSelector {...baseProps} bundle={makeBundle()} bundleItems={makeBundleItems()} />);

    const regularOption = screen.getByRole("button", { name: /Roasted Curry Powder only/ });
    const bundleOption = screen.getByRole("button", { name: /Curry Night Bundle/ });
    expect(regularOption).toHaveAttribute("aria-pressed", "true");
    expect(bundleOption).toHaveAttribute("aria-pressed", "false");
  });

  it("switching to the bundle option hides the regular Add to Cart and shows the bundle's own, never both at once", async () => {
    renderWithProviders(<PromotionSelector {...baseProps} bundle={makeBundle()} bundleItems={makeBundleItems()} />);

    screen.getByRole("button", { name: /Curry Night Bundle/ }).click();

    await waitFor(() => expect(screen.getByRole("button", { name: "Add bundle to cart" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Add to Cart" })).not.toBeInTheDocument();
  });

  it("switching back to regular restores the regular Add to Cart and hides the bundle's", async () => {
    renderWithProviders(<PromotionSelector {...baseProps} bundle={makeBundle()} bundleItems={makeBundleItems()} />);

    screen.getByRole("button", { name: /Curry Night Bundle/ }).click();
    await waitFor(() => expect(screen.getByRole("button", { name: "Add bundle to cart" })).toBeInTheDocument());

    screen.getByRole("button", { name: /Roasted Curry Powder only/ }).click();

    await waitFor(() => expect(screen.getByRole("button", { name: "Add to Cart" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Add bundle to cart" })).not.toBeInTheDocument();
  });

  it("shows a savings badge and the struck-through original total when the bundle is discounted", () => {
    renderWithProviders(<PromotionSelector {...baseProps} bundle={makeBundle({ standaloneTotal: 1000, discountedTotal: 800 })} bundleItems={makeBundleItems()} />);

    const bundleOption = screen.getByRole("button", { name: /Curry Night Bundle/ });
    expect(within(bundleOption).getByText("Save LKR 200")).toBeInTheDocument();
    expect(within(bundleOption).getByText("LKR 1,000")).toBeInTheDocument();
  });

  it("omits the savings badge when the bundle has no discount", () => {
    renderWithProviders(<PromotionSelector {...baseProps} bundle={makeBundle({ standaloneTotal: 800, discountedTotal: 800 })} bundleItems={makeBundleItems()} />);

    const bundleOption = screen.getByRole("button", { name: /Curry Night Bundle/ });
    expect(within(bundleOption).queryByText(/Save/)).not.toBeInTheDocument();
  });

  it("disables the bundle option and labels it unavailable when the bundle is out of stock", () => {
    renderWithProviders(<PromotionSelector {...baseProps} bundle={makeBundle({ inStock: false })} bundleItems={makeBundleItems()} />);

    const bundleOption = screen.getByRole("button", { name: /Curry Night Bundle/ });
    expect(bundleOption).toBeDisabled();
    expect(within(bundleOption).getByText("Currently unavailable")).toBeInTheDocument();
  });

  it("opens the cart drawer after adding the regular purchase", async () => {
    renderWithProviders(<PromotionSelector {...baseProps} bundle={makeBundle()} bundleItems={makeBundleItems()} />);

    screen.getByRole("button", { name: "Add to Cart" }).click();

    await waitFor(() => expect(useUiStore.getState().isCartDrawerOpen).toBe(true));
  });
});

describe("PromotionSelector — eligible gift offer present", () => {
  it("defaults to the regular purchase option, showing exactly one Add to Cart control", () => {
    renderWithProviders(<PromotionSelector {...baseProps} bundle={null} bundleItems={[]} giftOffer={makeGiftOffer()} />);

    expect(screen.getByRole("button", { name: "Add to Cart" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add free gift to cart" })).not.toBeInTheDocument();
  });

  it("shows the gift card with a Free price label and the gift's worth struck through", () => {
    renderWithProviders(<PromotionSelector {...baseProps} bundle={null} bundleItems={[]} giftOffer={makeGiftOffer({ standaloneValue: 350 })} />);

    const giftOption = screen.getByRole("button", { name: /Free Chili Paste/ });
    expect(within(giftOption).getByText("Free")).toBeInTheDocument();
    expect(within(giftOption).getByText("LKR 350")).toBeInTheDocument();
  });

  it("switching to the gift option hides the regular Add to Cart and shows the gift's own, never both at once", async () => {
    renderWithProviders(<PromotionSelector {...baseProps} bundle={null} bundleItems={[]} giftOffer={makeGiftOffer()} />);

    screen.getByRole("button", { name: /Free Chili Paste/ }).click();

    await waitFor(() => expect(screen.getByRole("button", { name: "Add free gift to cart" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Add to Cart" })).not.toBeInTheDocument();
  });

  it("disables the gift option and labels it unavailable when the gift is out of stock", () => {
    renderWithProviders(<PromotionSelector {...baseProps} bundle={null} bundleItems={[]} giftOffer={makeGiftOffer({ inStock: false })} />);

    const giftOption = screen.getByRole("button", { name: /Free Chili Paste/ });
    expect(giftOption).toBeDisabled();
    expect(within(giftOption).getByText("Currently unavailable")).toBeInTheDocument();
  });

  it("opens the cart drawer after adding the free gift", async () => {
    renderWithProviders(<PromotionSelector {...baseProps} bundle={null} bundleItems={[]} giftOffer={makeGiftOffer()} />);

    screen.getByRole("button", { name: /Free Chili Paste/ }).click();
    await waitFor(() => screen.getByRole("button", { name: "Add free gift to cart" }));
    screen.getByRole("button", { name: "Add free gift to cart" }).click();

    await waitFor(() => expect(useUiStore.getState().isCartDrawerOpen).toBe(true));
  });

  it("the gift CTA calls the gift-specific /api/cart/gift endpoint, never the regular or bundle add-to-cart routes", async () => {
    renderWithProviders(<PromotionSelector {...baseProps} bundle={null} bundleItems={[]} giftOffer={makeGiftOffer({ id: "gift-offer-99" })} />);

    screen.getByRole("button", { name: /Free Chili Paste/ }).click();
    await waitFor(() => screen.getByRole("button", { name: "Add free gift to cart" }));
    screen.getByRole("button", { name: "Add free gift to cart" }).click();

    await waitFor(() => expect(useUiStore.getState().isCartDrawerOpen).toBe(true));

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const giftCall = fetchMock.mock.calls.find(([url]) => url === "/api/cart/gift") as [string, { body: string }] | undefined;
    expect(giftCall).toBeDefined();
    expect(JSON.parse(giftCall![1].body)).toEqual({ giftOfferId: "gift-offer-99" });
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/cart/items" || url === "/api/cart/bundle")).toBe(false);
  });
});

describe("PromotionSelector — both a bundle and a gift offer eligible", () => {
  it("renders all three options, and switching between every pair never shows two Add-to-Cart controls at once", async () => {
    renderWithProviders(<PromotionSelector {...baseProps} bundle={makeBundle()} bundleItems={makeBundleItems()} giftOffer={makeGiftOffer()} />);

    expect(screen.getByRole("button", { name: /Roasted Curry Powder only/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Curry Night Bundle/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Free Chili Paste/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to Cart" })).toBeInTheDocument();

    screen.getByRole("button", { name: /Free Chili Paste/ }).click();
    await waitFor(() => expect(screen.getByRole("button", { name: "Add free gift to cart" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Add to Cart" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add bundle to cart" })).not.toBeInTheDocument();

    screen.getByRole("button", { name: /Curry Night Bundle/ }).click();
    await waitFor(() => expect(screen.getByRole("button", { name: "Add bundle to cart" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Add to Cart" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add free gift to cart" })).not.toBeInTheDocument();
  });
});
