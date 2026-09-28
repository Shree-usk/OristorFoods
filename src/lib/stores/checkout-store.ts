"use client";

import { create } from "zustand";

import type { DeliveryResolution, PaymentIntentResult } from "@/types/checkout";
import type { CheckoutAddressInput } from "@/validation/checkout.schema";

/**
 * Client-held checkout wizard state (STORY-025, spec decision #1).
 * Deliberately NOT persisted: there is no CheckoutSession table, so an
 * unfinished checkout's step state is lost on refresh/browser close (the
 * server-side cart itself survives — the customer restarts at step 1).
 * Every amount shown from this store is display-only; place-order
 * recomputes everything server-side.
 */

export const CHECKOUT_STEPS = ["Address", "Delivery", "Payment", "Review"] as const;
export type CheckoutStep = 1 | 2 | 3 | 4;

interface CheckoutState {
  step: CheckoutStep;
  /** One key per checkout attempt — regenerated only when totals change (fresh attempt). */
  idempotencyKey: string;
  address: CheckoutAddressInput | null;
  guestEmail: string | null;
  saveAddress: boolean;
  delivery: DeliveryResolution | null;
  intent: PaymentIntentResult | null;
  paymentConfirmed: boolean;
  /**
   * Set on successful placement, just before navigating to the
   * confirmation page — it keeps the wizard in a stable "order placed"
   * state (instead of racing the empty-cart redirect) and tells the next
   * /checkout visit to reset for a fresh attempt.
   */
  completedOrderNumber: string | null;
  goToStep: (step: CheckoutStep) => void;
  setAddress: (address: CheckoutAddressInput, guestEmail: string | null, saveAddress: boolean) => void;
  setDelivery: (delivery: DeliveryResolution | null) => void;
  setIntent: (intent: PaymentIntentResult | null) => void;
  markPaymentConfirmed: () => void;
  completeOrder: (orderNumber: string) => void;
  /** Totals changed mid-checkout: void the intent and start a fresh attempt. */
  resetPaymentAttempt: () => void;
  reset: () => void;
}

const initialState = () => ({
  step: 1 as CheckoutStep,
  idempotencyKey: crypto.randomUUID(),
  address: null,
  guestEmail: null,
  saveAddress: false,
  delivery: null,
  intent: null,
  paymentConfirmed: false,
  completedOrderNumber: null,
});

export const useCheckoutStore = create<CheckoutState>((set) => ({
  ...initialState(),
  goToStep: (step) => set({ step }),
  setAddress: (address, guestEmail, saveAddress) =>
    // A changed address can change the zone/charge — void downstream state.
    set({ address, guestEmail, saveAddress, delivery: null, intent: null, paymentConfirmed: false }),
  setDelivery: (delivery) => set({ delivery, intent: null, paymentConfirmed: false }),
  setIntent: (intent) => set({ intent, paymentConfirmed: false }),
  markPaymentConfirmed: () => set({ paymentConfirmed: true }),
  completeOrder: (orderNumber) => set({ completedOrderNumber: orderNumber }),
  resetPaymentAttempt: () =>
    set({ intent: null, paymentConfirmed: false, idempotencyKey: crypto.randomUUID(), step: 3 }),
  reset: () => set(initialState()),
}));
