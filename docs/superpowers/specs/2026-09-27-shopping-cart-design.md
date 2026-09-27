# STORY-024 Shopping Cart — Design Decisions

Spec for the shopping cart that sits between product discovery (Epic 03)
and checkout (STORY-025, not yet built): add/update/remove line items, a
guest cart, a persistent authenticated cart, and merge-on-login. Unlike
STORY-022 (which adapted two mature precedents) or STORY-023 (fully
greenfield), this story is a **mix**: it reuses a real, already-shipped
pricing engine (STORY-009) almost unchanged, but its guest-identity
mechanism is genuinely new — no route in this codebase has ever hand-set a
cookie before, and Wishlist's guest-is-client-only-localStorage pattern
doesn't fit here (see decision #2).

**Ground rule:** three pieces of pre-wired scaffolding already exist for
this exact story and must be extended, not duplicated or ignored:
`src/lib/stores/cart-store.ts` (count-only badge state, its own doc
comment says to extend/replace it), `src/hooks/use-add-to-cart.ts` (a stub
whose call sites on the PDP must not need to change), and
`src/components/storefront/layout/cart-badge.tsx` (already renders from
the store). Building a second, parallel cart-state mechanism next to these
would be exactly the kind of duplication this codebase's own conventions
rule out.

## 1. Stock tracking: add `Product.stockQuantity`, minimal scope

STORY-009 never built real inventory tracking — `Product` has only
`inStock: Boolean` (`prisma/schema.prisma:172`), no quantity field, no
reservation/hold model anywhere in the schema. But this story's AC is
explicit and non-negotiable: "adding a quantity that exceeds available
stock is blocked... the cart never allows checkout with a quantity greater
than currently available stock." A boolean can't express that.

**Decision (confirmed with the user):** add `stockQuantity Int @default(0)`
directly to `Product`, alongside the existing `inStock` field (both stay —
`inStock` remains the "is this orderable at all" gate `product.service.ts`
already checks everywhere; `stockQuantity` is the new "how many" number the
cart checks against). No separate `Reservation`/`StockHold` model, no
background cleanup job for abandoned-cart stock holds — this story does
not reserve stock ahead of checkout, it only validates a requested
quantity against the current on-hand number at add/update time and again
at cart-read time. A cart with 3 units of a product that later drops to
1 in stock surfaces the "no longer available at this quantity" notice
(decision #6), not an automatic silent adjustment.

## 2. Guest cart identity: a signed, httpOnly cookie — new infrastructure

Wishlist's and Recipe Bookmark's guest paths are both 100% client-side
(Zustand `persist` → `localStorage`), never touching the server until
login. That doesn't fit here: the AC explicitly asks for a guest cart
"persisted via a signed, httpOnly session/cart-token cookie" — because a
cart needs live price/stock revalidation (decision #6) even before login,
which a client-only store can't provide (the server has no way to validate
against a cart it's never seen).

Confirmed via repo-wide search: **no route in this codebase has ever
manually set a cookie** — NextAuth's own session cookie is the only cookie
this app has ever written. This is new, not an application of an existing
pattern.

**Mechanism:**
- On the first cart mutation (or the first `GET /api/cart`) from a request
  with no valid guest-cart cookie and no authenticated session, generate a
  high-entropy random token (`crypto.randomBytes(24).toString("base64url")`),
  HMAC-SHA256-sign it using the existing `AUTH_SECRET` (no new secret to
  provision), and create a `Cart` row with `guestToken` set to the raw
  token.
- The cookie value is `${token}.${signature}`. Every request that reads
  the cart re-derives the signature from the token portion and compares
  it (constant-time) against the signature portion before trusting the
  token as a lookup key — a tampered or guessed token fails verification
  and is treated as "no guest cart," never as someone else's cart.
- Cookie attributes: `httpOnly: true`, `secure: process.env.NODE_ENV ===
  "production"` (matching this codebase's existing dev-vs-prod convention
  elsewhere), `sameSite: "lax"`, `path: "/"`, a 30-day `maxAge` (cart
  abandonment — no scheduled cleanup job runs in this story, matching the
  story's own task list: "documented but not necessarily implemented as a
  running job").
- Name: `oristor-cart-token`.

## 3. Merge: server-to-server, not a client-payload POST

Because the guest cart is already a server-side `Cart` row (decision #2),
merging is structurally different from `mergeGuestWishlist` — there is no
client array to send. `CartMergeSync` (mirroring `WishlistMergeSync`'s
session-transition-watcher mechanism exactly, since no login page/event
exists yet in this codebase either) just POSTs to `/api/cart/merge` with
no body on the same `unauthenticated → authenticated` transition; the
route itself reads the still-present guest cookie, resolves that `Cart`
row, and merges it into the (created-if-needed) authenticated user's
`Cart`: matching `productId`s combine quantities (capped at
`stockQuantity`, decision #1), distinct `productId`s get appended. The
guest `Cart` row is deleted and the cookie is cleared (`Set-Cookie` with
`maxAge: 0`) only after the merge transaction commits successfully — a
failed merge leaves the guest cookie/cart intact, so it retries on the
next transition instead of silently losing items (same failure-safety
`WishlistMergeSync` already established).

## 4. Data model

```prisma
model Cart {
  id         String     @id @default(cuid())
  userId     String?    @unique
  user       User?      @relation(fields: [userId], references: [id], onDelete: Cascade)
  guestToken String?    @unique
  items      CartItem[]
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt

  @@index([guestToken])
}

model CartItem {
  id                String   @id @default(cuid())
  cartId            String
  cart              Cart     @relation(fields: [cartId], references: [id], onDelete: Cascade)
  productId         String
  product           Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  quantity          Int
  unitPriceSnapshot Decimal  @db.Decimal(10, 2)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([cartId, productId])
}
```

`userId`/`guestToken` are both nullable and independently unique — exactly
one is ever set per `Cart` row (enforced at the service layer, not a DB
constraint Postgres can express cleanly for "exactly one of two nullable
columns"). `@@unique([cartId, productId])` means adding a product already
in the cart increments quantity on the existing row rather than creating a
duplicate line (mirroring `RecipeBookmark`'s/`WishlistItem`'s
`@@unique([...])`-as-de-dup-guard convention). No `variantId` field — per
research, `Product` has no separate variant/SKU model (SKU is already a
scalar field directly on `Product`), so "specifying a variant/SKU" from
the AC's blueprint-derived wording has no corresponding schema concept
today; a cart line is just `(productId, quantity)`.

## 5. Pricing: reuse `resolvePricesForProducts` unchanged, per-line quantity

No changes to `pricing.service.ts`/`pricing.repository.ts` — the engine
(5 real tiers: campaign > sale > customerGroup > volumeDiscount > standard)
is reused exactly as every other caller already uses it. Every resolution
call passes `customerGroup: "Retail"`, matching the *exact* convention
`wishlist.service.ts`, `product.service.ts`, and `search.service.ts`
already use — `User` has no `customerGroup` field yet (deferred to
STORY-033/034's customer profile or STORY-038's admin roles), so there is
no way to derive a real tier today. This is a documented, codebase-wide
limitation, not a cart-specific shortcut: wholesale/distributor/export
pricing already works in the engine and needs zero cart-side changes once
a real customer-group-on-`User` story lands — only the `customerGroup`
value passed into these calls needs to change, from one place.

**Per-line, not bulk:** `resolvePricesForProducts`'s bulk form takes one
shared `quantity` for volume-discount resolution across all requested
products (correct for a listing page, where every product is being priced
at the same implicit quantity=1). A cart has a *different* quantity per
line, and volume-discount tier selection depends on it — so `cart.service.ts`
calls the single-product `resolvePrice({ productId, customerGroup: "Retail",
quantity: item.quantity })` once per line item, not the bulk function.
Carts are small (a handful of line items, not a paginated listing), so N
individual 5-query resolutions is the right tradeoff here — the bulk
function's whole reason to exist (avoiding N-per-product fetches at
listing scale) doesn't apply to a cart-sized N.

## 6. Revalidation: always-current totals, notice on change — not two competing rules

The AC asks for two things that sound like they could conflict: "no stale
totals shown" (recalculate automatically) and "surfacing a 'price
changed'... notice... rather than silently charging a stale price." They
don't conflict — they're sequenced. On every `GET /api/cart` and before
any mutation, for each line: resolve the live price (decision #5), compare
it to the stored `unitPriceSnapshot`, and if they differ, **first** mark
that line `priceChanged: true` in the response, **then** overwrite
`unitPriceSnapshot` with the live price. The customer always sees the
current, correct total (never stale) *and* gets told a price just moved —
the notice is a one-time flag on the response that changed it, not a
standing "this cart has an outdated price" banner that would itself become
stale information.

Availability works the same way, checked alongside price on every read:
a line where the product's `status !== "Published"` gets
`unavailable: true`; a line where `quantity > product.stockQuantity` gets
`quantityCapped: true` with the actual available number attached. Neither
case silently changes the stored `quantity` or removes the line — the
customer adjusts or removes it themselves from the cart UI, matching the
AC's explicit "rather than silently charging" instruction.

## 7. Reward points: arithmetic only, no ledger

`Product.rewardPoints` (`prisma/schema.prisma:171`) is today a static,
display-only integer — confirmed the *only* place it's read anywhere in
the codebase is one line on the PDP. No `RewardPoint`/loyalty-ledger model
exists, and building one is explicitly STORY-030's job. The cart's
"reward points earned" figure is pure derived arithmetic —
`product.rewardPoints × quantity` per line, summed for the cart total —
computed at read time from the already-joined `Product` row, never
persisted on `CartItem`. Nothing is awarded, redeemed, or written anywhere
outside the existing static field.

## 8. API surface

```
GET    /api/cart              — resolve current cart (guest cookie or session), revalidate (decision #6), return
POST   /api/cart/items        — add { productId, quantity }
PATCH  /api/cart/items/[id]   — update { quantity }
DELETE /api/cart/items/[id]   — remove
POST   /api/cart/merge        — merge guest cart into the authenticated user's cart (decision #3)
```

Every route follows this codebase's established `auth()`-where-needed →
typed-error-to-HTTP-status convention. Guest-cookie read/verify/create
(decision #2) is centralized in one `resolveCartIdentity(request)` helper
in `cart.service.ts`, called by every route — not duplicated five times.
`GET`/`POST /items`/`PATCH`/`DELETE` all work for both a guest and an
authenticated caller (the identity resolver picks the right lookup); only
`POST /merge` requires an authenticated session (401 otherwise, matching
`/api/wishlist/merge`'s existing convention).

## 9. Frontend: one hook, no guest/authenticated fork — simpler than Wishlist

Because the guest cart is *also* server-side (decision #2), the client
never needs to branch on `useSession().status` the way `useWishlist`/
`useRecipeBookmark` do — both a guest and an authenticated visitor's cart
comes from the exact same `GET /api/cart` (the identity resolver handles
which `Cart` row that means server-side). `useCart()` is a single
`useQuery(["cart"], fetchCart)` plus add/update/remove mutations, each
optimistic with rollback on rejection (same pattern `useRecipeBookmark`
already established), invalidating `["cart"]` on success.

- `src/lib/stores/cart-store.ts`'s standalone `count` field is retired —
  per that file's own doc comment ("count should stay derived from the
  real line items once they exist"). `CartBadge` derives the count
  directly from `useCart()`'s query-cache result
  (`items.reduce((sum, i) => sum + i.quantity, 0)`); no separate Zustand
  state for it.
- `useAddToCart(productId)` (`src/hooks/use-add-to-cart.ts`) gets a real
  implementation matching its existing `{ isAvailable, addToCart }` shape
  exactly — the PDP's current call sites need no changes, per that file's
  own doc comment.
- `CartDrawer` (mini-cart) and `src/app/(storefront)/cart/page.tsx` (full
  page: line items, quantity steppers, remove, subtotal, reward-points
  summary, empty-cart state, price/availability-change notices per line).
  The "Proceed to Checkout" CTA renders but is inert (no target route
  exists — STORY-025 is explicitly out of scope) rather than being omitted
  entirely, so the page reads as complete rather than half-built.
- `CartMergeSync` (decision #3), mounted in `src/app/providers.tsx`
  alongside the existing `WishlistMergeSync`/`RecipeBookmarkMergeSync`.

## 10. Security posture

The guest-cart cookie is `httpOnly` (unreadable/unwritable from client JS)
and signature-verified server-side on every read (decision #2) — a
tampered cookie value fails verification and is treated as "start a new
guest cart," never as access to an arbitrary `guestToken`. No route
accepts a client-supplied `userId`, `cartId`, or `guestToken` in a request
body; identity is always resolved server-side from the session or the
verified cookie. `PATCH`/`DELETE /api/cart/items/[id]` verify the target
`CartItem` belongs to the caller's own resolved `Cart` before mutating it
(never trust the `[id]` alone). Stock/price checks (decisions #1, #6) run
server-side on every mutation — a client can't force an over-quantity add
or a stale price by racing the UI.

## 11. Accessibility floor

Quantity steppers are real `<button>`s with descriptive `aria-label`s
("Increase quantity of {product name}"), not bare `+`/`-` glyphs with no
text alternative. Remove actions get a confirmable, announced state
change (`aria-live="polite"` region reporting "Removed {product name} from
cart", matching the existing account-side wishlist row's confirmed
pattern). Price-changed/unavailable notices are associated with their line
item via `aria-describedby`, not conveyed by color alone.

## 12. Testing plan

- Unit: `cart.repository.ts`'s de-dup-on-add behavior (`@@unique`-backed),
  guest-cookie signature generation/verification (valid token round-trips,
  tampered token rejected, expired/malformed token treated as absent);
  `cart.service.ts`'s add/update/remove (including the stock-exceeded
  rejection and the zero-quantity-removes-the-line case), merge (matching
  productIds combine and cap at `stockQuantity`, distinct productIds
  append, guest cart/cookie cleared only after a successful merge), and
  revalidation (price-changed flag set exactly once then snapshot
  updated; unavailable/quantityCapped flags on a Draft product or
  quantity now exceeding stock).
- Unit: Zod schema tests for the add/update payloads (positive-integer
  quantity, productId required).
- Unit: `use-add-to-cart` and `useCart` hook tests (optimistic update,
  rollback on a simulated stock-conflict rejection).
- E2e: add an item as a guest → reload → item persists (cookie survives) →
  sign in → guest cart merges into the account cart → guest cookie is
  gone. A second e2e case: add past `stockQuantity` is blocked with a
  visible message.
- Accessibility (axe): the cart page and the mini-cart drawer.

## 13. Documentation

`docs/architecture-decisions.md` gets an entry covering: the guest-cookie
strategy (name, signing scheme, expiry, security flags — decision #2, the
first hand-set cookie in this codebase, worth flagging clearly for the
next story that might want the same pattern); the server-to-server merge
algorithm (decision #3); why `stockQuantity` was added directly to
`Product` rather than a separate inventory model (decision #1, scoped
narrowly on purpose); and the `customerGroup: "Retail"`-everywhere
limitation (decision #5) so whoever builds real customer-group assignment
later knows exactly which call sites to revisit.
