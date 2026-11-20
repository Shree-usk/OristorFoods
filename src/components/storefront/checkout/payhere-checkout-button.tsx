"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/api-error";
import { fetchPaymentStatus } from "@/lib/api/checkout-client";
import { useCheckoutStore } from "@/lib/stores/checkout-store";

/**
 * PayHere's onsite JS SDK global — loaded on demand (see `loadPayHereSdk`
 * below), never eagerly and never under the mock provider. Callbacks are
 * plain property assignments on the shared `window.payhere` object; that
 * IS how PayHere's own API works (no per-call handler argument, no
 * removal API), so this component simply overwrites them fresh on every
 * `startPayment` call rather than fighting that shape.
 */
declare global {
  interface Window {
    payhere?: {
      startPayment: (payload: Record<string, unknown>) => void;
      onCompleted?: (orderId: string) => void;
      onDismissed?: () => void;
      onError?: (error: string) => void;
    };
  }
}

const PAYHERE_SDK_URL = "https://www.payhere.lk/lib/payhere.js";
const STATUS_POLL_INTERVAL_MS = 1500;
const STATUS_POLL_TIMEOUT_MS = 20000;

function loadPayHereSdk(): Promise<void> {
  if (window.payhere) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PAYHERE_SDK_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load the PayHere checkout script.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = PAYHERE_SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the PayHere checkout script."));
    document.body.appendChild(script);
  });
}

/**
 * PayHere's onsite checkout requires first_name/last_name/email/phone/
 * address/city/country — none of which are part of the signed hash, so
 * supplying them client-side from data the customer already entered on
 * earlier wizard steps cannot tamper with the amount PayHere will charge.
 * Falls back to the export flow's traveler details when there's no
 * standard address (Pickup) — a best-effort mapping, not guaranteed
 * complete for every edge case; this is prep work, verified manually
 * before any real go-live (see docs/PAYHERE_GO_LIVE_CHECKLIST.md).
 */
function useCustomerFields() {
  const { data: session } = useSession();
  const { address, guestEmail, traveler } = useCheckoutStore();

  const fullName = address?.recipientName ?? traveler?.travelerName ?? session?.user?.name ?? "";
  const [firstName, ...rest] = fullName.trim().split(/\s+/).filter(Boolean);

  return {
    first_name: firstName || "Customer",
    last_name: rest.join(" ") || ".",
    email: session?.user?.email ?? guestEmail ?? "",
    phone: address?.phone ?? traveler?.travelerPhone ?? "",
    address: address?.line1 ?? "N/A",
    city: address?.city ?? traveler?.travelerCountry ?? "N/A",
    country: "Sri Lanka",
  };
}

async function pollUntilSettled(providerReference: string, deadline: number): Promise<{ status: "Succeeded" | "Failed"; failureReason: string | null } | null> {
  const result = await fetchPaymentStatus(providerReference);
  if (result.status === "Succeeded" || result.status === "Failed") return { status: result.status, failureReason: result.failureReason };
  if (Date.now() >= deadline) return null;

  await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_INTERVAL_MS));
  return pollUntilSettled(providerReference, deadline);
}

interface PayHereCheckoutButtonProps {
  disabled?: boolean;
  onSucceeded: () => void;
  onFailed: (reason: string) => void;
}

export function PayHereCheckoutButton({ disabled, onSucceeded, onFailed }: PayHereCheckoutButtonProps) {
  const { intent } = useCheckoutStore();
  const customer = useCustomerFields();
  const [phase, setPhase] = useState<"idle" | "loading" | "awaiting" | "confirming">("idle");
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  async function handlePay() {
    if (!intent?.clientPayload) return;
    setPhase("loading");
    try {
      await loadPayHereSdk();
      if (cancelledRef.current || !window.payhere) return;

      window.payhere.onDismissed = () => {
        if (cancelledRef.current) return;
        setPhase("idle");
        onFailed("Payment was cancelled.");
      };
      window.payhere.onError = (error) => {
        if (cancelledRef.current) return;
        setPhase("idle");
        onFailed(error || "The payment could not be processed. Please try again.");
      };
      window.payhere.onCompleted = (orderId) => {
        if (cancelledRef.current) return;
        // NOT proof of payment — PayHere's own notify_url callback is the
        // only thing that ever actually confirms this. Poll the database's
        // view of it instead of trusting this callback directly.
        setPhase("confirming");
        void pollUntilSettled(orderId, Date.now() + STATUS_POLL_TIMEOUT_MS)
          .then((settled) => {
            if (cancelledRef.current) return;
            if (!settled) {
              onFailed("We're still confirming your payment — check your email or order history shortly before trying again.");
              setPhase("idle");
              return;
            }
            if (settled.status === "Succeeded") {
              onSucceeded();
            } else {
              onFailed(settled.failureReason ?? "Your payment was declined. Please try another method.");
              setPhase("idle");
            }
          })
          .catch(() => {
            if (!cancelledRef.current) {
              onFailed("Could not confirm your payment status. Please check your order history.");
              setPhase("idle");
            }
          });
      };

      setPhase("awaiting");
      window.payhere.startPayment({ ...intent.clientPayload, ...customer });
    } catch (error) {
      setPhase("idle");
      onFailed(error instanceof ApiError ? error.message : "Could not start PayHere checkout. Please try again.");
    }
  }

  const labels = {
    idle: "Pay with PayHere",
    loading: "Loading PayHere…",
    awaiting: "Waiting for PayHere…",
    confirming: "Confirming your payment…",
  } as const;

  return (
    <Button type="button" onClick={handlePay} disabled={disabled || phase !== "idle" || !intent?.clientPayload}>
      {labels[phase]}
    </Button>
  );
}
