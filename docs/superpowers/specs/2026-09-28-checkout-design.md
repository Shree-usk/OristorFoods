# STORY-025 Checkout — Design Decisions

Spec for the multi-step checkout flow that converts a cart (STORY-024,
shipped) into a confirmed order. Checkout is an orchestration layer — it
owns no pricing, zone, or payment-provider logic. Because its three
service dependencies (payment STORY-026, shipping STORY-027, orders
STORY-028) are unbuilt, this story includes **thin, checkout-facing
slices** of each (confirmed with the user): a mock payment provider
behind the STORY-026 `PaymentProvider` interface, city→zone rate
resolution per the confirmed `.claude/skills/delivery-zone-pricing`
model, and atomic Order creation. Webhooks, refunds, cancellation, the
order-status pipeline, order-history APIs, ERP events, and admin zone
CRUD all stay in their own stories.

## 1. Checkout state: client-held wizard, no `CheckoutSession` table

**Decision (confirmed with the user):** the four-step wizard's state
(entered address, resolved delivery, payment intent reference,
idempotency key) lives in a client-side Zustand store
(`src/lib/stores/checkout-store.ts`, not persisted). Each step has a
server API that validates its input and returns authoritative data, and
`place-order` re-derives everything server-side. No `CheckoutSession`
table — the story's own task list says to prefer client state unless
server persistence is genuinely needed, and the guest cart cookie
(STORY-024 decision #2) already anchors server-side identity.

**Documented consequence:** unfinished checkout state (steps completed,
fields entered) is lost on refresh or browser close. The cart itself is
unaffected — it is server-side and survives; the customer restarts at
step 1. This is an accepted trade-off, recorded in
`docs/architecture-decisions.md`.

## 2. Server-side calculations are authoritative — the client's numbers are display-only

Every figure the wizard shows (line prices, subtotal, delivery charge,
reward points, grand total) is fetched from the server, and
`place-order` ignores all client-supplied amounts: it re-resolves the
cart's live prices (via the STORY-024 revalidation path), re-checks
stock, re-resolves the delivery charge from the submitted address's
city, recomputes reward points and the grand total, and verifies the
confirmed payment's amount equals that recomputed grand total. A client
cannot force a stale price, an over-quantity order, or a mismatched
payment by manipulating request payloads. A mismatch between the
payment's amount and the recomputed total (e.g. a price changed
mid-checkout) is a typed `checkout_totals_changed` rejection — the
customer is returned to the Review step with a clear message and a
fresh payment intent is required.

## 3. Idempotent order placement

Because there is no server-side checkout session, a network retry of
`place-order` (or a double-click racing the disabled-button state) must
not create two orders.

- `Order.idempotencyKey String @unique` — generated client-side
  (`crypto.randomUUID()`) once per checkout attempt when the store
  initializes, sent with `place-order`.
- The service attempts creation; a `P2002` unique violation on
  `idempotencyKey` means an order for this attempt already exists — the
  service fetches that order and returns it **after verifying
  ownership** (its `userId` matches the session user, or its
  `guestToken` matches the verified guest-cart cookie token), so a
  guessed key can never fetch someone else's order. This is safe under
  concurrent requests: the DB unique constraint, not application logic,
  is the arbiter — one request wins the insert, the other reads the
  winner's row.
- A *new* checkout attempt (e.g. after `checkout_totals_changed`)
  regenerates the key.

## 4. Order number: DB-unique, no counters

`Order.orderNumber String @unique`, format
`ORS-YYYYMMDD-XXXXXX` where `XXXXXX` is a random base-32 (Crockford
alphabet, no ambiguous chars) suffix. Generation retries on a `P2002`
collision (bounded, 5 attempts) — never `count + 1`, which double-issues
under concurrency. Human-readable, no sequence table, no lock.

## 5. Data model (one migration)

```prisma
model Address {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  recipientName String
  phone        String
  line1        String
  line2        String?
  city         String
  district     String?
  postalCode   String?
  isDefault    Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([userId])
}
```

Saved addresses exist **only for authenticated users** (`userId`
required — this is the model STORY-034 will later manage). A guest's
address is never stored in `Address`; it exists only as the immutable
snapshot on the order (decision #7).

`Product.weightGrams Int?` — nullable; needed by weight-based zone
rates. Seed products get real weights.

Delivery models exactly per the delivery-zone-pricing skill:

```prisma
model DeliveryZone {
  id        String   @id @default(cuid())
  name      String   @unique
  cities    String[]           // matched case/whitespace-insensitively, decision #9
  isActive  Boolean  @default(true)
  rate      DeliveryRate?
  overrides DeliveryRateOverride[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model DeliveryRate {
  id                String           @id @default(cuid())
  zoneId            String           @unique
  zone              DeliveryZone     @relation(fields: [zoneId], references: [id], onDelete: Cascade)
  rateType          DeliveryRateType // Flat | WeightBased | ValueBased
  flatAmount        Decimal?         @db.Decimal(10, 2)
  tiers             Json?            // [{ upTo: number, amount: string }] ascending; see decision #8
  estimatedDaysMin  Int?
  estimatedDaysMax  Int?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model DeliveryRateOverride {
  id             String       @id @default(cuid())
  zoneId         String
  zone           DeliveryZone @relation(fields: [zoneId], references: [id], onDelete: Cascade)
  campaignName   String
  startsAt       DateTime
  endsAt         DateTime
  freeShipping   Boolean      @default(false)
  overrideAmount Decimal?     @db.Decimal(10, 2) // ignored when freeShipping
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([zoneId, startsAt, endsAt])
}

model ShippingSetting {
  id                     String  @id @default("global") // singleton row
  freeShippingThreshold  Decimal @db.Decimal(10, 2)
  updatedAt              DateTime @updatedAt
}
```

Payment per STORY-026's model (sync mock path only in this story):

```prisma
enum PaymentStatus { Pending Succeeded Failed Refunded }

model Payment {
  id                String        @id @default(cuid())
  provider          String        // "mock" in this story
  providerReference String        @unique
  status            PaymentStatus @default(Pending)
  amount            Decimal       @db.Decimal(10, 2)
  currency          String        @default("LKR")
  order             Order?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

Order per STORY-028's field list, so 028 extends rather than migrates:

```prisma
enum OrderStatus { PendingConfirmation Confirmed Processing Dispatched Delivered Cancelled Returned }

model Order {
  id              String      @id @default(cuid())
  orderNumber     String      @unique          // decision #4
  idempotencyKey  String      @unique          // decision #3
  userId          String?
  user            User?       @relation(fields: [userId], references: [id], onDelete: SetNull)
  guestToken      String?                       // verified guest-cart token snapshot; authorizes guest confirmation view
  guestEmail      String?
  status          OrderStatus @default(Confirmed)
  subtotal        Decimal     @db.Decimal(10, 2)
  deliveryCharge  Decimal     @db.Decimal(10, 2)
  discount        Decimal     @db.Decimal(10, 2) @default(0) // reserved for STORY-029
  tax             Decimal     @db.Decimal(10, 2) @default(0) // decision #11
  grandTotal      Decimal     @db.Decimal(10, 2)
  couponCode      String?                       // reserved for STORY-029
  rewardPointsEarned Int      @default(0)
  erpSyncStatus   String?                       // reserved for STORY-028
  paymentId       String?     @unique
  payment         Payment?    @relation(fields: [paymentId], references: [id], onDelete: SetNull)
  deliveryZoneName String
  // Immutable address snapshot (decision #7) — flattened copies, no relation
  shipRecipientName String
  shipPhone       String
  shipLine1       String
  shipLine2       String?
  shipCity        String
  shipDistrict    String?
  shipPostalCode  String?
  items           OrderItem[]
  statusHistory   OrderStatusHistory[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId])
}

model OrderItem {
  id          String  @id @default(cuid())
  orderId     String
  order       Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId   String?
  product     Product? @relation(fields: [productId], references: [id], onDelete: SetNull)
  // Snapshots at time of purchase — never rely on live product data
  productName String
  productSku  String
  unitPrice   Decimal @db.Decimal(10, 2)
  quantity    Int
  lineTotal   Decimal @db.Decimal(10, 2)
  rewardPointsEarned Int @default(0)
}

model OrderStatusHistory {
  id        String      @id @default(cuid())
  orderId   String
  order     Order       @relation(fields: [orderId], references: [id], onDelete: Cascade)
  status    OrderStatus
  actor     String      // "system:checkout" in this story
  createdAt DateTime    @default(now())
}
```

## 6. Atomic, oversell-proof order placement

`order.service.ts#createOrderFromCheckout` runs one Prisma
`$transaction`:

1. Re-read cart items; reject if empty/unavailable/quantity-capped.
2. **Conditional stock decrement per line:**
   `updateMany({ where: { id, stockQuantity: { gte: qty } }, data: { stockQuantity: { decrement: qty } } })`
   — if the affected count is 0, throw `insufficient_stock`, rolling the
   whole transaction back. The row-level condition makes concurrent
   purchases of the same stock safe: two buyers racing the last unit
   cannot both decrement. No partial/ghost order can survive a failure
   at any step.
3. Create `Order` + `OrderItem` snapshots + initial `OrderStatusHistory`
   (`Confirmed`, actor `system:checkout`).
4. Delete the cart's items (cart row and guest cookie survive — the
   cookie also authorizes the guest's confirmation view via
   `Order.guestToken`).

Payment is confirmed *before* this transaction (step 3 of the wizard);
the transaction only links the already-`Succeeded` `Payment` row after
verifying its amount equals the recomputed grand total (decision #2).

## 7. Immutable address snapshot on the order

`Order` stores flattened `ship*` copies of the delivery address at
placement time. Later edits to a saved `Address` row (or its deletion)
cannot alter historical orders. `OrderItem` snapshots product
name/SKU/price identically.

## 8. Shipping calculation rules (exact, per the delivery-zone-pricing skill)

`shipping.service.ts#resolveDelivery(city, subtotal, totalWeightGrams)`:

1. **Zone resolution:** normalize the city (decision #9) and find active
   zones whose normalized `cities` include it.
   - No match → result `{ status: "no_zone" }`. The UI shows "We don't
     deliver to this city yet — contact us for a shipping quote" and
     blocks progress. Never a silent ₨0.
   - Multiple matches (admin misconfiguration; "should never happen"):
     deterministically pick the zone with the alphabetically-first name
     and log a warning. Tested.
2. **Campaign override wins:** if the zone has a `DeliveryRateOverride`
   whose `[startsAt, endsAt]` contains now: charge =
   `freeShipping ? 0 : overrideAmount`. Skip the base rate entirely.
3. **Otherwise the zone's base rate,** per its `rateType`:
   - `Flat`: `flatAmount`.
   - `WeightBased`: `tiers` = `[{ upTo: grams, amount }]` ascending;
     charge = first tier with `totalWeightGrams <= upTo`; heavier than
     the last tier → the last tier's amount. **If any cart line's
     product has `weightGrams: null`, the result is
     `{ status: "quote_required" }`** — same fail-safe UI as `no_zone`,
     never ₨0.
   - `ValueBased`: `tiers` = `[{ upTo: subtotal, amount }]` ascending;
     charge = first tier with `subtotal <= upTo`; above the last tier →
     the last tier's amount.
4. **Global free-shipping threshold applied last:** if
   `subtotal >= ShippingSetting.freeShippingThreshold`, charge = 0
   regardless of zone, rate model, or override. The response includes
   `freeShippingApplied` and, when below,
   `amountToFreeShipping` for the "Add ₨X more for free shipping"
   message.
5. Missing/malformed configuration (zone with no rate row, tier JSON
   that fails its Zod parse) → `{ status: "config_error" }`, fail-safe
   UI, never a crash or ₨0.

Precedence, explicitly: **campaign override → base rate → global
free-shipping threshold last.** The calculation is a pure exported
function unit-tested independently of the repository.

## 9. City normalization

One shared helper `normalizeCity(value)`: trim → collapse internal
whitespace runs to single spaces → `toLowerCase()` (`en` locale
semantics; city names here are ASCII/Latin). Zone `cities` entries and
customer input are both normalized before comparison; stored values keep
their original casing for display. Unknown city ⇒ `no_zone` (decision
#8.1); ambiguous city (multiple active zones) ⇒ deterministic
alphabetical-first zone + logged warning.

## 10. Payment: STORY-026's interface, mock-only, synchronous

- `src/services/payment/payment-provider.interface.ts` — the
  `PaymentProvider` contract (`createIntent`, `confirmPayment`; the
  fuller contract incl. `handleWebhook`/`refund` lands with STORY-026).
- `src/services/payment/mock-payment.provider.ts` — `MockPaymentProvider`
  simulates success, decline, and timeout, selected by the payment
  method the customer picks ("Mock — Success" / "Mock — Decline"), no
  external network.
- `src/services/payment.service.ts` depends only on the interface;
  the active provider is selected via `PAYMENT_PROVIDER=mock` (env) at
  one provider-selection point. No webhook endpoint, no refund
  implementation in this story (confirmed with the user).
- A `Payment` row is persisted per attempt with explicit status
  transitions Pending → Succeeded/Failed.
- No raw card/credential data is ever accepted, persisted, or logged.
- Intent amount is computed server-side from the live cart + resolved
  delivery charge for the submitted city; `place-order` verifies
  `payment.status === Succeeded && payment.amount === recomputed total`.

## 11. Explicit exclusions (confirmed with the user, unchanged)

Coupons (STORY-029 — no coupon UI; `discount`/`couponCode` schema fields
reserved), taxes (nothing modeled platform-wide; the Review step states
"Prices include applicable taxes", `Order.tax` stores 0 — flagged as an
open item), payment webhooks and refunds (STORY-026), order
cancellation/status transitions and ERP events (STORY-028), admin
delivery-zone CRUD (STORY-055), order-history dashboard (STORY-036).

## 12. API surface

```
GET  /api/checkout/addresses     — authenticated: list saved addresses (401 for guests)
POST /api/checkout/address       — validate a delivery address; authed callers may pass save: true
POST /api/checkout/delivery      — { city } → resolved zone, charge, window, free-shipping messaging (uses caller's cart for subtotal/weight)
POST /api/checkout/payment/intent — { city } → creates Payment row + mock intent for the server-computed amount
POST /api/payments/confirm       — { providerReference, outcome } → mock sync confirm (STORY-026's route, sync slice)
POST /api/checkout/place-order   — { idempotencyKey, address | savedAddressId, guestEmail?, providerReference, saveAddress? } → order
```

All routes follow the established `auth()` → typed-error-to-HTTP-status
convention (`checkout-responses.ts` mirroring `cart-responses.ts`).
Identity is always the session or the verified guest-cart cookie — no
route accepts a client-supplied userId/cartId/amount.

## 13. Frontend

`src/app/(storefront)/checkout/page.tsx` (server component) redirects to
`/cart` when the revalidated cart is empty, else renders the client
wizard: step indicator (Address → Delivery → Payment → Review), one
RHF+Zod form per step (schemas shared with the server from
`src/validation/checkout.schema.ts`), Zustand checkout store. Guest path
captures email inline with a non-blocking "log in for faster checkout"
link; authenticated path offers the saved-address picker plus
"save this address". Payment step renders mock method options. Review
step lists items, delivery charge, reward points to earn, grand total,
and places the order. Declined payment returns to the Payment step with
a clear error, all other state preserved. Confirmation page
`checkout/confirmation/[orderNumber]` (server component; authorized by
session userId or guest-cookie token match) shows the order number,
summary, delivery estimate, and — for guests — a non-blocking "create an
account" prompt. Cart badge/query invalidated after placement. WCAG
form labeling, keyboard navigation, `aria-live` step/error announcements,
usable at 375px — matching the cart's shipped conventions.

## 14. Testing plan

- Unit (Vitest): shipping calc — all three rate models, threshold
  boundary (below/at/above), override precedence (active wins, expired
  falls back, threshold still beats an override amount), `no_zone`,
  ambiguous city, `quote_required` on missing weight, `config_error`;
  city normalization; payment service success/decline/timeout against
  the mock; order placement — happy path, conditional-decrement
  insufficient-stock rollback (no ghost order), idempotent replay
  returns the same order and never double-decrements, order-number
  collision retry; checkout service — totals-changed rejection,
  payment-amount mismatch rejection; Zod schema edges; route tests per
  endpoint (401s, guest vs authed).
- E2E (Playwright): full guest checkout — seed zones, add to cart,
  address → delivery (visible charge) → mock-success payment → review →
  place order → confirmation with order number → cart cleared; declined
  payment returns to Payment step with state preserved, retry with
  success completes; free-shipping threshold crossing shows "Free".
- Accessibility (axe) on each wizard step and the confirmation page.

## 15. Documentation

`docs/architecture-decisions.md` gains the STORY-025 entry: the checkout
state machine (steps, allowed transitions, validation gates), client-held
state + its refresh-loss consequence, idempotency-key design, random
order-number scheme, conditional-decrement stock strategy, shipping
precedence rules + normalization, the payment-amount verification, and
the tax/coupon open items.
