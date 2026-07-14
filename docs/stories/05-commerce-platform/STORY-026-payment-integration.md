# STORY-026: Payment Integration

**Status:** Draft
**Epic:** 05 — Commerce Platform
**Priority:** High
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast, Distributor

## User Story
As a customer at the payment step of checkout, I want to pay securely using a supported payment method, so that I can complete my order with confidence that my payment details are handled safely.

As a developer building checkout, I want a payment-provider-agnostic service interface, so that the concrete gateway can be plugged in later without checkout, cart, or order code needing to change.

## Description
`docs/blueprint.md` Section 10 explicitly lists "exact payment gateway provider(s)" as an unconfirmed open item — the source spec only says "Payment Gateway" generically. Per `CLAUDE.md`'s instruction not to guess at unconfirmed integrations, **this story does not implement a named payment gateway.** Instead it builds the payment-service abstraction — a provider-agnostic interface (create payment intent, confirm payment, handle webhook/callback, refund) — plus a mock/sandbox provider implementing that interface for local development, testing, and demoing the checkout flow end to end. When the gateway decision is made, a follow-up story implements a concrete provider adapter against this interface; no other module (checkout, cart, order) should need to change at that point.

## Acceptance Criteria
- [ ] **This story is explicitly scoped to the payment-service abstraction and a mock/sandbox provider — concrete gateway integration (Stripe, PayHere, WebXPay, or any other named provider) is BLOCKED pending the provider decision referenced in blueprint Section 10, and is out of scope here.**
- [ ] A `PaymentProvider` TypeScript interface is defined (e.g. `createIntent`, `confirmPayment`, `handleWebhook`, `refund`, `getStatus`) that any future concrete gateway adapter must implement, independent of any specific provider's SDK shape.
- [ ] A `MockPaymentProvider` implements the interface fully: it can simulate a successful payment, a declined payment, and a timeout/error scenario (selectable in dev/test via a query param or config flag), without calling any external network service.
- [ ] `payment.service.ts` depends only on the `PaymentProvider` interface (dependency-injected/configured, not hardcoded), so swapping `MockPaymentProvider` for a real adapter later requires no changes to `checkout.service.ts` or `order.service.ts`.
- [ ] A `Payment` record is persisted per order-attempt (provider used, intent/reference id, status, amount, currency, timestamps) regardless of which provider is active, giving order management (STORY-028) a consistent payment status to read.
- [ ] Payment status transitions (pending → succeeded / failed / refunded) are modeled explicitly and exposed to `order.service.ts` so order status (STORY-028) can react to them.
- [ ] No raw card/payment credential data is ever persisted or logged by the platform — the mock provider design reflects the same "we never touch raw card data" pattern a real hosted-checkout/tokenized gateway integration would require, so the real integration doesn't have to retrofit this later.
- [ ] A webhook/callback endpoint pattern exists (`/api/payments/webhook`) that the mock provider can call to simulate an async provider confirmation, proving the checkout flow correctly handles both synchronous and asynchronous payment confirmation without code changes at real-gateway-integration time.
- [ ] Checkout (STORY-025) can complete an end-to-end order using only the mock provider in local/dev/test environments, with no environment variable pointing at a real payment gateway required to develop or demo the rest of the commerce flow.
- [ ] Refund is modeled at the interface level (`refund(paymentId, amount?)`) even though only the mock implements it in this story, so STORY-028's return/refund flow and the future admin refund action (STORY-047) have a stable contract to call.
- [ ] The Dependencies section of this story and any code comments in `payment.service.ts` clearly flag that concrete gateway selection is an open business decision, not a technical gap, so future contributors don't assume the mock is a bug.

## Tasks
- [ ] **Database:** Add a `Payment` model to `prisma/schema.prisma` (`orderId`/`checkoutSessionId`, `provider`, `providerReference`, `status`, `amount`, `currency`, `createdAt`, `updatedAt`) with an enum for payment status (`PENDING`, `SUCCEEDED`, `FAILED`, `REFUNDED`).
- [ ] **API:** `POST /api/payments/intent` — creates a payment intent via the configured `PaymentProvider`, returns a client-usable reference/token.
- [ ] **API:** `POST /api/payments/confirm` — confirms a payment (used by the mock provider's synchronous path).
- [ ] **API:** `POST /api/payments/webhook` — receives async provider callbacks, verifies/simulates signature validation, updates `Payment` status.
- [ ] **Service/Backend:** Define `src/services/payment/payment-provider.interface.ts` (the `PaymentProvider` contract).
- [ ] **Service/Backend:** Implement `src/services/payment/mock-payment.provider.ts` (`MockPaymentProvider`) with configurable success/decline/timeout simulation.
- [ ] **Service/Backend:** Implement `src/services/payment.service.ts` — provider-agnostic orchestration (create intent, confirm, handle webhook, refund), selecting the active provider via config/env (`PAYMENT_PROVIDER=mock`), never importing a concrete provider directly outside the provider-selection point.
- [ ] **Service/Backend:** `payment.repository.ts` — the only place the `Payment` Prisma model is queried/mutated.
- [ ] **Frontend:** A payment-method selection UI component in the checkout Payment step (STORY-025) that renders provider-agnostic method options (in dev/test: "Mock — Success", "Mock — Decline") so the review/confirm flow can be exercised visually.
- [ ] **Validation:** Zod schema for payment-intent creation and webhook payload shape (`src/validation/payment.schema.ts`).
- [ ] **Testing:** Vitest unit tests for `payment.service.ts` against `MockPaymentProvider` covering success, decline, timeout, and refund paths.
- [ ] **Testing:** Vitest test asserting `payment.service.ts` has zero direct references to any concrete gateway SDK/package (guards the abstraction boundary).
- [ ] **Documentation:** Document the `PaymentProvider` interface contract and how to add a real adapter later in `docs/architecture-decisions.md`, explicitly cross-referencing blueprint Section 10's open item.

## Dependencies
- STORY-024 (Shopping Cart), STORY-025 (Checkout) — payment is invoked from the checkout payment step.
- **Open external dependency (blocking, not a story dependency):** the concrete payment gateway provider is unconfirmed per `docs/blueprint.md` Section 10. This story does not wait on that decision — it is explicitly scoped around it — but any follow-up "implement `[Provider]` adapter" story is blocked until the client confirms the gateway.

## Out of Scope
- Any concrete payment gateway SDK/API integration (Stripe, PayHere, WebXPay, or others) — blocked pending provider decision, see above.
- Recurring/subscription billing (not in current scope per blueprint).
- Admin-side refund UI (STORY-047, Admin Orders Console) — this story only exposes the `refund()` contract the admin action will call.
- PCI-DSS compliance certification work specific to a chosen gateway (depends on which gateway/hosted-checkout model is eventually selected).

## References
- `docs/blueprint.md` Section 5 (Commerce, Commerce lifecycle — Payment), Section 10 (Open Items — "exact payment gateway provider(s)")
- `docs/folder-structure.md` (`src/services/`)
