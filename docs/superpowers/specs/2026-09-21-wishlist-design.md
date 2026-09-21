# Wishlist — Design

**Story:** `docs/stories/03-product-platform/STORY-013-wishlist.md`
**Date:** 2026-09-21

## Summary

Replaces the count-only wishlist stubs already scaffolded for STORY-013
(`useWishlist`, `wishlist-store.ts`, `WishlistBadge`) with a real
guest/logged-in wishlist: client-persisted for guests, server-persisted
(new `Wishlist`/`WishlistItem` Prisma models) for logged-in users, with an
automatic merge on login and a `/account/wishlist` page supporting
per-item and bulk move-to-cart.

Two dependencies this story's acceptance criteria assume are not actually
built yet, resolved with the user before design:

- **Cart (STORY-024, Epic 05) doesn't exist.** `useAddToCart` is already a
  permanently-unavailable stub (used by the PDP's Add to Cart button).
  **Decision:** wishlist's move-to-cart/move-all-to-cart UI is built now
  and wired to that same stub — buttons render but stay disabled until
  STORY-024 replaces the stub, exactly matching the PDP's existing
  precedent. No second stub pattern invented.
- **No login page exists yet** (`/account/login` is a dead link in
  `AccountMenu`; NextAuth's `Credentials` provider and session plumbing
  exist, but no route renders a sign-in form). **Decision:** the
  guest→account merge is triggered by a global session-state watcher, not
  a login page's submit handler, so it works regardless of which future
  story builds the actual sign-in UI.

## Schema Change

```prisma
// prisma/schema.prisma

model Wishlist {
  id        String         @id @default(cuid())
  userId    String         @unique
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  items     WishlistItem[]
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt
}

model WishlistItem {
  id         String   @id @default(cuid())
  wishlistId String
  wishlist   Wishlist @relation(fields: [wishlistId], references: [id], onDelete: Cascade)
  productId  String
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  addedAt    DateTime @default(now())

  @@unique([wishlistId, productId])
  @@index([productId])
}
```

`User` gains `wishlist Wishlist?`; `Product` gains `wishlistItems
WishlistItem[]` (same inverse-relation convention as `ProductImage`,
`BundleItem`, etc.). One wishlist per user, auto-created on first add
(`findOrCreateWishlist`), not at signup — mirrors how this codebase avoids
creating rows before they're needed elsewhere.

Applied day-to-day via `db push`; a real `prisma migrate dev`-produced
migration file is generated at the end against a freshly restarted `prisma
dev` (the documented first-migration-of-session workflow in
`docs/architecture-decisions.md`) once the schema is final.

## Repository / Service / API

New `src/repositories/wishlist.repository.ts` (Prisma only, no business
logic):

```ts
export function findOrCreateWishlist(userId: string): Promise<Wishlist>
export function addItem(wishlistId: string, productId: string)
export function removeItem(wishlistId: string, productId: string)
export function listItemsWithProduct(wishlistId: string)
  // joins Product (name, slug, images, inStock, status) — one query, no N+1
export function findExistingProductIds(wishlistId: string, productIds: string[]): Promise<string[]>
  // for merge de-dup
```

New `src/services/wishlist.service.ts` (calls the repository above plus
`pricing.service.ts`, never Prisma directly):

```ts
export interface WishlistItemView {
  productId: string;
  name: string;
  slug: string;
  imageSrc: string;
  imageAlt: string;
  inStock: boolean;
  price: ResolvedPrice | null; // null if no price configured — same convention as product listing
}

export async function getWishlist(userId: string): Promise<WishlistItemView[]>
export async function addToWishlist(userId: string, productId: string): Promise<void>
export async function removeFromWishlist(userId: string, productId: string): Promise<void>
export async function mergeGuestWishlist(userId: string, productIds: string[]): Promise<void>
```

- `getWishlist`: lists items, then resolves prices in bulk via
  `resolvePricesForProducts` (same 5-query bulk pattern `product.service.ts`
  already uses — never per-item resolution).
- `addToWishlist`: `findOrCreateWishlist` then `addItem`; unique
  constraint makes a duplicate add a no-op (Prisma `P2002` caught and
  swallowed, not surfaced as an error — toggling an already-wishlisted
  item from two tabs shouldn't 500).
- `mergeGuestWishlist`: filters `productIds` to ones that
  `findProductById`-resolve to a `Published` product (reuses
  `product.repository.ts`'s existing lookup, no new query shape),
  de-dupes against `findExistingProductIds`, then calls `addItem` for the
  remainder. Silently drops anything unpublished/deleted — no partial-
  failure reporting back to the client, matching the story's own
  "de-duplicates and ignores products that no longer exist or are
  unpublished" task wording.

Routes — the **first authenticated routes in this codebase**; each starts
with the same guard:

```ts
const session = await auth();
if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

- `GET /api/wishlist` → `getWishlist(session.user.id)`
- `POST /api/wishlist` → Zod-validated `{ productId }` → `addToWishlist`
- `DELETE /api/wishlist/[productId]` → `removeFromWishlist`
- `POST /api/wishlist/merge` → Zod-validated `{ productIds: string[] }`
  (capped, e.g. max 200 — a guest localStorage array is the only input
  source, but still validated like any request body) → `mergeGuestWishlist`

`src/validation/wishlist.schema.ts`: `addWishlistItemSchema`,
`mergeWishlistSchema`, reusing this project's existing "validate, don't
guess" convention (no `.catch()` defaulting here, unlike the listing
routes — a malformed wishlist mutation should 400, not silently coerce).

## Guest State (Zustand)

`src/lib/stores/wishlist-store.ts` — extended in place (not replaced;
`WishlistBadge` already imports it) from count-only to real item storage,
persisted via `zustand/middleware`'s `persist`:

```ts
interface WishlistState {
  items: string[]; // product IDs
  add: (productId: string) => void;
  remove: (productId: string) => void;
  has: (productId: string) => boolean;
  clear: () => void;
}
```

`count` is deleted as stored state; `WishlistBadge` reads
`items.length` directly (derived, not duplicated). `persist` key:
`"oristor-wishlist"`, matching the project's existing localStorage naming
style for client-only state.

## `useWishlist(productId)`

Replaces the stub in `src/hooks/use-wishlist.ts`, **keeping the exact same
return shape** (`{ isWishlisted, isAvailable, toggle }`) so `ProductCard`
and `ProductActions` need no changes beyond the import already being
correct. Internally branches on `useSession().status`:

- **authenticated:** TanStack Query — `useQuery(["wishlist"], ...)` backed
  by `GET /api/wishlist`, `useMutation` for add/remove with optimistic
  cache update (toggle should feel instant, not wait on a round trip) and
  rollback on error.
- **guest/loading:** reads/writes `useWishlistStore` directly, no network
  call.

`isAvailable` becomes unconditionally `true` (the feature is live now,
unlike the still-stubbed cart).

## Merge-on-Login

New `src/components/providers/wishlist-merge-sync.tsx`, a client component
with no rendered output, mounted inside `SessionProvider` in
`src/app/providers.tsx`:

```tsx
export function WishlistMergeSync() {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const prevStatus = useRef(status);

  useEffect(() => {
    if (prevStatus.current !== "authenticated" && status === "authenticated") {
      const guestItems = useWishlistStore.getState().items;
      if (guestItems.length > 0) {
        fetch("/api/wishlist/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: guestItems }),
        }).then(() => {
          useWishlistStore.getState().clear();
          queryClient.invalidateQueries({ queryKey: ["wishlist"] });
        });
      }
    }
    prevStatus.current = status;
  }, [status, queryClient]);

  return null;
}
```

Fires exactly once per unauthenticated→authenticated transition
(ref-tracked, not effect-dependency-tracked, so it doesn't re-fire on
unrelated re-renders). Works no matter which future story builds the
actual sign-in form — it reacts to session state, not a submit handler.

## Frontend

- **`ProductCard`** (`src/components/storefront/product/product-card.tsx`):
  new heart-icon button, `absolute top-2 right-2 z-10`, alongside the
  existing top-left status `Badge` and bottom-left out-of-stock `Badge`
  overlay pattern already on this card. Since the card is a `<Link>`, the
  button calls `e.preventDefault(); e.stopPropagation()` before
  `wishlist.toggle()`.
- **`/account/wishlist`**
  (`src/app/(storefront)/account/wishlist/page.tsx`, Client Component —
  needs `useSession`/TanStack Query for the logged-in path and the
  Zustand store for the guest path, so it can't be a Server Component like
  the search results page): item list (image, name, resolved price,
  in-stock badge), per-item remove, per-item "move to cart" (disabled,
  wired to `useAddToCart`, per the cart-stub decision above), "move all to
  cart" (iterates in-stock items only, skips + visually flags out-of-stock
  ones rather than failing), empty state with a "Browse Products" CTA
  linking to `/products`. `generateMetadata` (via a small server-rendered
  wrapper around the client page, same split every other account-style
  page in this codebase would need) sets `robots: { index: false, follow:
  false }` — a personal account page is never a search-index target, same
  reasoning `/products/search` already applied for its own `noindex`
  case.
- **Confirmation on add/remove:** no toast library exists in this project
  yet (checked — no `sonner`/toast component anywhere). Rather than
  introduce and globally wire a toast provider for one story, this ships
  as an **inline confirmation** — a brief `aria-live="polite"` status
  region near the toggle/list action, satisfying the AC's "toast **or**
  inline confirmation" wording without adding a new dependency. A future
  story that actually needs toasts project-wide can introduce one
  properly.
- **Header badge:** `WishlistBadge` already exists and already renders in
  the header — only its data source changes (count-only store → derived
  `items.length` on the extended store), no new integration point needed.

## Testing

- Vitest, repository (real DB, this project's convention): unique
  constraint behavior, `findExistingProductIds` correctness.
- Vitest, service: `mergeGuestWishlist` dedup + unpublished/deleted-product
  filtering (mirrors `search-suggestions-service.test.ts`'s style —
  seeded products, explicit unpublished case); `addToWishlist` double-add
  no-op; `getWishlist` price-resolution shape.
- Vitest, Zod schemas: valid/invalid product ID(s), merge array size cap.
- Vitest, `wishlist-store.ts`: add/remove/has/clear, persistence round-trip.
- Playwright e2e: guest adds 2 items → logs in → both appear in
  `/account/wishlist`, guest store cleared; move-to-cart and
  move-all-to-cart with one out-of-stock item in the batch, confirming the
  out-of-stock item is skipped/flagged rather than blocking the rest.

## Out of Scope (unchanged from story)

Cart internals (STORY-024 owns real add-to-cart), wishlist sharing between
users, building the actual login page/form (a future story's job — this
one only assumes NextAuth session state exists, which it already does).
