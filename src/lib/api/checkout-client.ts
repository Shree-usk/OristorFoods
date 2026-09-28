import { readApiError } from "@/lib/api/api-error";
import type { DeliveryResolution, PaymentIntentResult, SavedAddress } from "@/types/checkout";
import type { CheckoutAddressInput, PlaceOrderInput } from "@/validation/checkout.schema";

/**
 * Browser client for the checkout HTTP API (STORY-025). Non-2xx responses
 * throw ApiError carrying the server's message and `code`, so the wizard
 * can branch on typed failures (e.g. totals_changed → back to Payment).
 */

export async function fetchSavedAddresses(): Promise<SavedAddress[]> {
  const response = await fetch("/api/checkout/addresses", { credentials: "include" });
  if (!response.ok) throw await readApiError(response);
  const body = (await response.json()) as { addresses: SavedAddress[] };
  return body.addresses;
}

export async function validateAddress(input: {
  address: CheckoutAddressInput;
  guestEmail?: string;
  save?: boolean;
}): Promise<{ savedAddressId?: string }> {
  const response = await fetch("/api/checkout/address", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await readApiError(response);
  return (await response.json()) as { savedAddressId?: string };
}

export async function resolveDelivery(city: string): Promise<DeliveryResolution> {
  const response = await fetch("/api/checkout/delivery", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ city }),
  });
  if (!response.ok) throw await readApiError(response);
  return (await response.json()) as DeliveryResolution;
}

export async function createPaymentIntent(city: string): Promise<PaymentIntentResult> {
  const response = await fetch("/api/checkout/payment/intent", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ city }),
  });
  if (!response.ok) throw await readApiError(response);
  return (await response.json()) as PaymentIntentResult;
}

export async function confirmPayment(
  providerReference: string,
  outcome: "success" | "decline" | "timeout",
): Promise<{ status: "Succeeded" | "Failed"; failureReason: string | null }> {
  const response = await fetch("/api/payments/confirm", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providerReference, outcome }),
  });
  if (!response.ok) throw await readApiError(response);
  return (await response.json()) as { status: "Succeeded" | "Failed"; failureReason: string | null };
}

export async function placeOrder(input: PlaceOrderInput): Promise<{ orderNumber: string; replayed: boolean }> {
  const response = await fetch("/api/checkout/place-order", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await readApiError(response);
  return (await response.json()) as { orderNumber: string; replayed: boolean };
}
