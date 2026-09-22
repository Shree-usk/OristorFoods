# Product Compare — Design

**Story:** `docs/stories/03-product-platform/STORY-014-product-compare.md`
**Date:** 2026-09-22

## Summary

A lightweight, session-only compare feature: customers add up to 4 products
to a compare tray from `ProductCard` or the PDP, see a header indicator with
a quick-access mini-drawer, and view a full side-by-side comparison at
`/products/compare?ids=...`. No server-side persistence — the story is
explicit that this is client state only, cleared on session end, never
synced across devices. This removes an entire class of complexity STORY-013
(wishlist) had to solve (guest/auth branching, merge-on-login) — compare has
neither concept; it behaves identically whether the visitor is signed in or
not.

Three decisions confirmed with the user before design:

- **Tray indicator is a mini-drawer/popover**, not a plain badge+link like
  `WishlistBadge`. Compare is inherently a staging action across several
  products before committing to the comparison page, so mid-session
  visibility of what's currently selected (with quick remove) is more useful
  here than it was for wishlist's single-item-at-a-time flow.
- **Max-4 behavior is block + inline message**, not silent replace-oldest.
  Matches this project's no-toast-library convention (established in
  STORY-013): an `aria-live="polite"` message near the control that was
  clicked, not a global toast. Silently dropping a user's existing selection
  (replace-oldest) was rejected as the same class of surprise-data-loss risk
  flagged in STORY-013's final review for an unrelated bug — better to make
  the user's 5th click a deliberate no-op with an explanation.
- **Control placement is a Scale icon next to the wishlist heart** in
  `ProductCard`'s existing top-right image overlay (and next to the heart in
  `ProductActions` on the PDP), not a separate below-the-fold control. Keeps
  both quick-actions in one predictable spot.

## Data Layer

No schema change — compare reads existing `Product`/`Brand`/`ProductNutrition`/
`ProductIngredient`/`ProductAllergen`/`ProductCertification` tables, already
modeled by STORY-009 and already queried in full by
`findProductDetailBySlug` (the PDP's repository function). Compare needs the
same shape, batched by id instead of singular by slug.

New `src/repositories/product.repository.ts` addition (same file the PDP's
query lives in — this is a sibling batch variant, not a new file):

```ts
export function findProductsForCompareByIds(ids: string[]) {
  if (ids.length === 0) return Promise.resolve([]);
  return prisma.product.findMany({
    where: { id: { in: ids }, status: "Published" },
    include: {
      brand: true,
      nutrition: true,
      ingredients: { orderBy: { sortOrder: "asc" } },
      allergens: true,
      certifications: true,
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
    },
  });
}
```

One query for up to 4 products — no N+1 from calling the PDP's
`findProductDetailBySlug` four times, and no need for `categories`/`videos`/
`bundle` (not part of the comparison table).

## Service

New `getProductsForCompare(productIds: string[])` in `product.service.ts`
(alongside `getProductDetail`, `getProductsByIds`, `listRelatedProducts` —
same file, same "reuse `resolvePricesForProducts`, never per-item" rule):

```ts
export interface CompareItem {
  id: string;
  slug: string;
  name: string;
  imageSrc: string;
  imageAlt: string;
  brandName: string | null;
  price: number;
  currency: string;
  nutrition: ProductDetailNutrition | null; // reuses the PDP's existing type
  ingredients: ProductDetailIngredient[];
  allergenNames: string[];
  certificationNames: string[];
  rating: number | null; // averageRating from getReviewSummary, or null
  reviewCount: number | null;
}

export async function getProductsForCompare(productIds: string[]): Promise<CompareItem[]>
```

- Batch-fetches via `findProductsForCompareByIds`, bulk-resolves prices via
  `resolvePricesForProducts` (same convention as every other list-shaped
  fetch in this file), and resolves each product's review summary via the
  **existing** `getReviewSummary(productId)` provider hook
  (`product-detail-extensions.ts`) — already defaults to `null` until
  STORY-015 registers a real provider, so "rating gracefully omitted if
  STORY-015 isn't shipped" is free; no new code needed for that requirement.
- Drops a product from the result if it has no resolved price (same
  established convention as `getWishlist`/`getProductsByIds` — never show a
  priceless item as if it had one). If the caller asked for 4 ids and one
  drops, the compare page renders the remaining 3 — not an error.
- Order of the result follows the order of the caller's `productIds` array
  (the tray's insertion order), not database order — a two-line `Map`
  lookup after the batch fetch. (This is the STORY-013 final-review finding
  about `getProductsByIds`'s unspecified order — avoided here from the
  start rather than retrofitted.)

## API

```
GET /api/products/compare?ids=id1,id2,id3,id4
```

`src/validation/product-compare.schema.ts`:

```ts
export const compareIdsSchema = z
  .string()
  .transform((raw) => [...new Set(raw.split(",").map((id) => id.trim()).filter(Boolean))])
  .pipe(z.array(z.string().min(1)).min(1).max(4));
```

Parsed from the query string, then `safeParse`'d — **400 on more than 4 ids
or zero valid ids**, not a silent truncate. This is a GET, but the story
treats "how many products am I comparing" as something the user must be
told about accurately, not silently degraded (unlike a listing page's
filters, where falling back to a default is fine) — the same reasoning
STORY-013's mutation routes used for the "validate, don't guess" convention,
applied here because silently dropping a 5th id would show an incomplete
comparison with no indication why. This route is public (no auth guard) —
same trust level as `/api/products/by-ids`, ids come from the client's own
session-only store.

```ts
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = compareIdsSchema.safeParse(url.searchParams.get("ids") ?? "");
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid ids" }, { status: 400 });
  }
  const items = await getProductsForCompare(parsed.data);
  return NextResponse.json({ items }, { status: 200 });
}
```

**Reused, not rebuilt:** the tray drawer's thumbnails (image/name/href only)
call the **existing** `GET /api/products/by-ids` endpoint from STORY-013 —
same `ProductListItem` shape already used for the guest wishlist page. No
new endpoint for the drawer; only the full comparison page needs the richer
`CompareItem` shape.

## Client State (Zustand)

New `src/lib/stores/compare-store.ts` — deliberately **no `persist`
middleware**, unlike the wishlist store. The story requires this to clear on
session end, not survive a browser restart:

```ts
interface CompareState {
  items: string[]; // product ids, insertion order, max 4
  add: (productId: string) => "added" | "duplicate" | "full";
  remove: (productId: string) => void;
  has: (productId: string) => boolean;
  clear: () => void;
}

export const useCompareStore = create<CompareState>((set, get) => ({
  items: [],
  add: (productId) => {
    const { items } = get();
    if (items.includes(productId)) return "duplicate";
    if (items.length >= 4) return "full";
    set({ items: [...items, productId] });
    return "added";
  },
  remove: (productId) => set({ items: get().items.filter((id) => id !== productId) }),
  has: (productId) => get().items.includes(productId),
  clear: () => set({ items: [] }),
}));
```

`add`'s three-way return (not void) is what lets `CompareToggle` show the
right inline message without re-deriving tray-full/already-added logic
itself.

## Frontend

- **`CompareToggle`** (`src/components/storefront/product/compare-toggle.tsx`)
  — shared control used by both `ProductCard` and `ProductActions`. Same
  icon-button shape as the wishlist heart (`Scale` from `lucide-react`,
  `aria-pressed`, `aria-label` toggling between "Add to compare"/"Remove
  from compare"). On a blocked `add()` (`"full"` or `"duplicate"`), shows a
  brief `aria-live="polite"` message next to the control ("Compare is full —
  remove one to add another" / already-selected is simply a no-toggle, no
  message needed since the icon's pressed state already shows it). In
  `ProductCard`, positioned `absolute top-2 right-10` (left of the existing
  wishlist heart at `right-2`) in the same overlay row; needs the same
  `preventDefault`/`stopPropagation` treatment since the card is a `<Link>`.
- **`CompareTrayIndicator`** (`src/components/storefront/layout/compare-tray-indicator.tsx`)
  — header icon + count badge (structurally mirrors `WishlistBadge`), but
  opens a popover instead of linking directly. Popover body: fetches
  thumbnails via the existing by-ids endpoint keyed on `useCompareStore`'s
  `items`, renders up to 4 rows (thumbnail, name, per-item remove button),
  a "Compare" button linking to `/products/compare?ids=<items.join(",")>`,
  and an empty state ("Add products to compare") when `items.length === 0`.
  Rendered in `HeaderActions` next to `WishlistBadge`.
- **`/products/compare` page**
  (`src/app/(storefront)/products/compare/page.tsx`) — reads `ids` from the
  URL query string via `searchParams` (not the store directly), so the page
  is shareable/bookmarkable and works when landed on directly without the
  tray having been populated client-side first. Server Component wrapper
  (no session/auth dependency, unlike wishlist's account page) fetches via
  `getProductsForCompare` directly (no need to go through the API route
  internally — Server Components call services directly, same as every
  other page in this codebase) and passes the result to a
  `CompareView` Client Component for the interactive per-item remove.
  - **0-1 products in the result:** empty state, "Add more products to
    compare" with a link to `/products`.
  - **2-4 products:** desktop (`md:` and up) renders a `<table>`, one
    column per product, one row per attribute (image, name, price,
    calories/protein/fat/carbs from nutrition, ingredients list, allergens,
    certifications, brand, rating). Mobile renders the same data as
    stacked, scrollable per-product cards (reuses the same attribute-row
    layout, just card-per-product instead of column-per-product). No
    existing responsive table/card precedent elsewhere in this codebase —
    plain Tailwind `hidden md:block` (table) / `md:hidden` (cards) pair,
    same breakpoint convention (`md:`) this codebase already uses
    elsewhere for layout switches (e.g. `ProductCard`'s `sizes` attribute).
  - **Per-item remove:** removes the id from both `useCompareStore` and the
    URL (client-side `router.replace` with the id stripped from `ids`), so
    the tray drawer and the page stay in agreement without a full page
    reload.

## Testing

- Vitest, `compare-store.ts`: `add`'s three return states (added/duplicate/
  full), max-4 enforcement, `remove`/`has`/`clear`.
- Vitest, `product-compare.schema.ts`: valid ids, dedup, over-4 rejection,
  empty-string rejection.
- Vitest, `getProductsForCompare`: published-only filtering, price-drop
  when unconfigured, result order follows input order (not DB order),
  graceful `nutrition`/`rating` null when absent, brand name resolution.
- Vitest, `GET /api/products/compare`: 400 on invalid/over-4 ids, 200 with
  the expected shape on valid ids.
- Vitest, `CompareToggle`: inline message appears on blocked add, doesn't
  appear on a normal toggle.
- Playwright e2e: add 3 products from the listing grid, open the tray
  drawer, confirm count and thumbnails, navigate to
  `/products/compare`, confirm all three render with correct attributes;
  remove one from the page, confirm it drops from both the page and the
  tray count.

## Out of Scope (unchanged from story)

Server-side persistence of compare selections, comparing more than 4
products, rating data if STORY-015 hasn't shipped (degrades to `null`
automatically via the existing provider-hook pattern — no special-casing
needed).
