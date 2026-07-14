import { create } from "zustand";

/**
 * Count-only client state for the header's cart badge. The full cart
 * (line items, quantities, pricing) is owned by STORY-024 (Shopping
 * Cart) — that story should extend or replace this store with real data
 * rather than introducing a second cart store; `count` should stay
 * derived from the real line items once they exist.
 */
interface CartState {
  count: number;
  setCount: (count: number) => void;
  increment: (by?: number) => void;
  decrement: (by?: number) => void;
}

export const useCartStore = create<CartState>((set) => ({
  count: 0,
  setCount: (count) => set({ count: Math.max(0, count) }),
  increment: (by = 1) => set((state) => ({ count: state.count + by })),
  decrement: (by = 1) => set((state) => ({ count: Math.max(0, state.count - by) })),
}));
