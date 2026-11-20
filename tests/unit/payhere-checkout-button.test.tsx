import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({ useSession: () => mockUseSession() }));

const fetchPaymentStatus = vi.fn();
vi.mock("@/lib/api/checkout-client", () => ({ fetchPaymentStatus: (...args: unknown[]) => fetchPaymentStatus(...args) }));

const { PayHereCheckoutButton } = await import("@/components/storefront/checkout/payhere-checkout-button");
const { useCheckoutStore } = await import("@/lib/stores/checkout-store");

function setIntent(provider: string) {
  useCheckoutStore.setState({
    intent: { providerReference: "payhere_abc123", amount: 1000, currency: "LKR", provider, clientPayload: { merchant_id: "1", hash: "abc" } },
    address: { recipientName: "Nimal Perera", phone: "+94712345678", line1: "12 Galle Rd", city: "Colombo" },
    guestEmail: "nimal@example.com",
  });
}

beforeEach(() => {
  mockUseSession.mockReturnValue({ status: "unauthenticated", data: null });
  fetchPaymentStatus.mockReset();
  setIntent("payhere");
  window.payhere = undefined;
});

afterEach(() => {
  vi.useRealTimers();
  useCheckoutStore.setState({ intent: null, address: null, guestEmail: null });
});

/** Simulates the SDK already being present (as if payhere.js already loaded) so no real network/script injection happens in jsdom. */
function installFakeSdk(onStartPayment: (payload: Record<string, unknown>) => void) {
  window.payhere = { startPayment: onStartPayment };
}

describe("PayHereCheckoutButton", () => {
  it("merges the intent's clientPayload with the customer's own checkout details when starting payment", async () => {
    const startPayment = vi.fn();
    installFakeSdk(startPayment);

    render(<PayHereCheckoutButton onSucceeded={vi.fn()} onFailed={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Pay with PayHere/i }));

    await waitFor(() => expect(startPayment).toHaveBeenCalledTimes(1));
    const payload = startPayment.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.merchant_id).toBe("1");
    expect(payload.hash).toBe("abc");
    expect(payload.first_name).toBe("Nimal");
    expect(payload.last_name).toBe("Perera");
    expect(payload.email).toBe("nimal@example.com");
    expect(payload.phone).toBe("+94712345678");
  });

  it("calls onSucceeded once the polled status settles to Succeeded after onCompleted fires", async () => {
    fetchPaymentStatus.mockResolvedValueOnce({ status: "Succeeded", failureReason: null });
    const onSucceeded = vi.fn();
    installFakeSdk((_payload) => {
      void _payload;
      window.payhere!.onCompleted?.("payhere_abc123");
    });

    render(<PayHereCheckoutButton onSucceeded={onSucceeded} onFailed={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Pay with PayHere/i }));

    await waitFor(() => expect(onSucceeded).toHaveBeenCalledTimes(1));
    expect(fetchPaymentStatus).toHaveBeenCalledWith("payhere_abc123");
  });

  it("calls onFailed with the gateway's reason once the polled status settles to Failed", async () => {
    fetchPaymentStatus.mockResolvedValueOnce({ status: "Failed", failureReason: "Card declined by issuer" });
    const onFailed = vi.fn();
    installFakeSdk(() => window.payhere!.onCompleted?.("payhere_abc123"));

    render(<PayHereCheckoutButton onSucceeded={vi.fn()} onFailed={onFailed} />);
    await userEvent.click(screen.getByRole("button", { name: /Pay with PayHere/i }));

    await waitFor(() => expect(onFailed).toHaveBeenCalledWith("Card declined by issuer"));
  });

  it("treats onDismissed as a cancellation, never a success", async () => {
    const onSucceeded = vi.fn();
    const onFailed = vi.fn();
    installFakeSdk(() => window.payhere!.onDismissed?.());

    render(<PayHereCheckoutButton onSucceeded={onSucceeded} onFailed={onFailed} />);
    await userEvent.click(screen.getByRole("button", { name: /Pay with PayHere/i }));

    await waitFor(() => expect(onFailed).toHaveBeenCalledWith("Payment was cancelled."));
    expect(onSucceeded).not.toHaveBeenCalled();
    expect(fetchPaymentStatus).not.toHaveBeenCalled();
  });

  it("surfaces onError's message without ever calling onSucceeded", async () => {
    const onSucceeded = vi.fn();
    const onFailed = vi.fn();
    installFakeSdk(() => window.payhere!.onError?.("Card not supported"));

    render(<PayHereCheckoutButton onSucceeded={onSucceeded} onFailed={onFailed} />);
    await userEvent.click(screen.getByRole("button", { name: /Pay with PayHere/i }));

    await waitFor(() => expect(onFailed).toHaveBeenCalledWith("Card not supported"));
    expect(onSucceeded).not.toHaveBeenCalled();
  });

  it("never calls onSucceeded just because onCompleted fired — only a Succeeded poll result proves it", async () => {
    fetchPaymentStatus.mockResolvedValue({ status: "Pending", failureReason: null });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onSucceeded = vi.fn();
    const onFailed = vi.fn();
    installFakeSdk(() => window.payhere!.onCompleted?.("payhere_abc123"));

    render(<PayHereCheckoutButton onSucceeded={onSucceeded} onFailed={onFailed} />);
    await userEvent.click(screen.getByRole("button", { name: /Pay with PayHere/i }), { delay: null });

    await vi.advanceTimersByTimeAsync(21000);

    expect(onSucceeded).not.toHaveBeenCalled();
    expect(onFailed).toHaveBeenCalledWith(expect.stringMatching(/still confirming/i));
  });

  it("disables the button while intent.clientPayload is not yet available", () => {
    useCheckoutStore.setState({ intent: null });
    render(<PayHereCheckoutButton onSucceeded={vi.fn()} onFailed={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Pay with PayHere/i })).toBeDisabled();
  });
});
