"use client";

import { create } from "zustand";

import type { DeliveryResolution, FulfilmentMethod, PaymentIntentResult, PaymentMethod } from "@/types/checkout";
import type { CheckoutAddressInput, TravelerDetailsInput } from "@/validation/checkout.schema";

/**
 * Client-held checkout wizard state (STORY-025, spec decision #1).
 * Deliberately NOT persisted: there is no CheckoutSession table, so an
 * unfinished checkout's step state is lost on refresh/browser close (the
 * server-side cart itself survives — the customer restarts at step 1).
 * Every amount shown from this store is display-only; place-order
 * recomputes everything server-side.
 *
 * Export fulfilment flow: fixed semantic step slots 1–5 (Export Details,
 * Address, Delivery, Payment, Review). Step 1 only ever renders for a cart
 * with an export-declared packaging line — checkout-wizard.tsx computes
 * that at render time and skips straight to step 2 otherwise, so a plain
 * cart's step numbering/back-forward flow is unaffected by this field
 * existing. For Pickup, ExportDetailsStep's continue jumps straight to
 * step 4 (Payment) — Address/Delivery (2/3) are skipped entirely.
 */

export const CHECKOUT_STEPS = ["Export Details", "Address", "Delivery", "Payment", "Review"] as const;
export type CheckoutStep = 1 | 2 | 3 | 4 | 5;

interface CheckoutState {
  step: CheckoutStep;
  /** One key per checkout attempt — regenerated only when totals change (fresh attempt). */
  idempotencyKey: string;
  /** Export fulfilment flow. Null until the ExportDetailsStep is submitted. */
  fulfilmentMethod: FulfilmentMethod | null;
  traveler: TravelerDetailsInput | null;
  address: CheckoutAddressInput | null;
  guestEmail: string | null;
  saveAddress: boolean;
  delivery: DeliveryResolution | null;
  /** Story 4 (Payment Restriction). The customer's choice on the Payment step — null until they pick one. */
  paymentMethod: PaymentMethod | null;
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
  setExportDetails: (fulfilmentMethod: FulfilmentMethod, traveler: TravelerDetailsInput) => void;
  setAddress: (address: CheckoutAddressInput, guestEmail: string | null, saveAddress: boolean) => void;
  setDelivery: (delivery: DeliveryResolution | null) => void;
  setPaymentMethod: (paymentMethod: PaymentMethod | null) => void;
  setIntent: (intent: PaymentIntentResult | null) => void;
  markPaymentConfirmed: () => void;
  completeOrder: (orderNumber: string) => void;
  /**
   * Totals changed mid-checkout, OR the chosen payment method is no
   * longer allowed (Story 4: the cart gained/lost custom packaging since
   * the method was picked) — void the intent AND the method, forcing a
   * genuine re-selection per the brief's own rule, and start a fresh
   * attempt.
   */
  resetPaymentAttempt: () => void;
  reset: () => void;
}

const initialState = () => ({
  step: 1 as CheckoutStep,
  idempotencyKey: crypto.randomUUID(),
  fulfilmentMethod: null,
  traveler: null,
  address: null,
  guestEmail: null,
  saveAddress: false,
  delivery: null,
  paymentMethod: null,
  intent: null,
  paymentConfirmed: false,
  completedOrderNumber: null,
});

export const useCheckoutStore = create<CheckoutState>((set) => ({
  ...initialState(),
  goToStep: (step) => set({ step }),
  setExportDetails: (fulfilmentMethod, traveler) =>
    // A changed fulfilment choice can change everything downstream (whether
    // Address/Delivery even apply, the delivery charge, the grand total).
    set({ fulfilmentMethod, traveler, address: null, delivery: null, paymentMethod: null, intent: null, paymentConfirmed: false }),
  setAddress: (address, guestEmail, saveAddress) =>
    // A changed address can change the zone/charge — void downstream state.
    set({ address, guestEmail, saveAddress, delivery: null, paymentMethod: null, intent: null, paymentConfirmed: false }),
  setDelivery: (delivery) => set({ delivery, paymentMethod: null, intent: null, paymentConfirmed: false }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod, intent: null, paymentConfirmed: false }),
  setIntent: (intent) => set({ intent, paymentConfirmed: false }),
  markPaymentConfirmed: () => set({ paymentConfirmed: true }),
  completeOrder: (orderNumber) => set({ completedOrderNumber: orderNumber }),
  resetPaymentAttempt: () =>
    set({ paymentMethod: null, intent: null, paymentConfirmed: false, idempotencyKey: crypto.randomUUID(), step: 4 }),
  reset: () => set(initialState()),
}));
