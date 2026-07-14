import { beforeEach, describe, expect, it } from "vitest";

import { useCartStore } from "@/lib/stores/cart-store";
import { useWishlistStore } from "@/lib/stores/wishlist-store";

describe("useCartStore", () => {
  beforeEach(() => {
    useCartStore.setState({ count: 0 });
  });

  it("starts at zero", () => {
    expect(useCartStore.getState().count).toBe(0);
  });

  it("increments by 1 by default", () => {
    useCartStore.getState().increment();
    expect(useCartStore.getState().count).toBe(1);
  });

  it("increments by a custom amount", () => {
    useCartStore.getState().increment(3);
    expect(useCartStore.getState().count).toBe(3);
  });

  it("decrements but never below zero", () => {
    useCartStore.getState().increment(1);
    useCartStore.getState().decrement(5);
    expect(useCartStore.getState().count).toBe(0);
  });

  it("setCount clamps negative values to zero", () => {
    useCartStore.getState().setCount(-5);
    expect(useCartStore.getState().count).toBe(0);
  });
});

describe("useWishlistStore", () => {
  beforeEach(() => {
    useWishlistStore.setState({ count: 0 });
  });

  it("starts at zero", () => {
    expect(useWishlistStore.getState().count).toBe(0);
  });

  it("increments and decrements independently of the cart store", () => {
    useWishlistStore.getState().increment(2);
    useCartStore.getState().increment(5);
    expect(useWishlistStore.getState().count).toBe(2);
    expect(useCartStore.getState().count).toBe(5);
  });
});
