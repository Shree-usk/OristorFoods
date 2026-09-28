# STORY-024 Shopping Cart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full shopping cart — add/update/remove line items, a guest cart persisted via a signed httpOnly cookie, a persistent authenticated cart, merge-on-login, live price/stock revalidation, and a reward-points-earned estimate.

**Architecture:** A `Cart`/`CartItem` pair keyed by either `userId` or a signed `guestToken` (never both), following this codebase's Service Layer convention (route → service → repository). Reuses the existing pricing engine (`resolvePricesForProducts`/`resolvePrice`) unchanged, called per line item with that line's own quantity. Guest identity is a new pattern for this codebase (a hand-signed httpOnly cookie, HMAC'd with the existing `AUTH_SECRET`) — everything else (merge-on-session-transition, optimistic mutations, typed errors) follows precedent already shipped for Wishlist/Recipe Bookmark.

**Tech Stack:** Next.js 16 App Router / Server Components, TypeScript strict, Prisma 7 + `@prisma/adapter-pg`, Zod, TanStack Query, Zustand, NextAuth `auth()`, Node `crypto`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-shopping-cart-design.md` (read this first — every model field, function name, route path, and component name below is taken directly from it). Also authoritative: `docs/stories/05-commerce-platform/STORY-024-shopping-cart.md` (acceptance criteria).

## Global Constraints

- **Never call Prisma directly outside a repository.** `cart.repository.ts` is the only file that imports `@/lib/db`'s `prisma` for `Cart`/`CartItem`.
- **Never trust a client-supplied `userId`, `cartId`, or `guestToken`.** Identity is always resolved server-side: from `auth()`'s session, or from a verified guest cookie. `PATCH`/`DELETE /api/cart/items/[id]` re-check that the target `CartItem` belongs to the caller's own resolved cart before mutating.
- **The guest cookie is `oristor-cart-token`, httpOnly, signed with `AUTH_SECRET` via HMAC-SHA256.** A tampered or unverifiable cookie is treated as "no guest cart" — never throws, never trusts the raw value.
- **`resolvePricesForProducts`/`resolvePrice` are called with `customerGroup: "Retail"` everywhere** (matching every existing caller — `User` has no customer-group field yet). Cart pricing is per-line via the single-product `resolvePrice({ productId, customerGroup: "Retail", quantity })`, never the bulk function (volume-discount tiers depend on each line's own quantity).
- **`Recipe`-story-style status enums stay PascalCase** — this story adds no new enum, but `Product.status` checks use the existing `"Published"` string exactly as every other consumer does.
- **Migration workflow:** use `npx prisma db push` for iteration; produce the real committed migration via the offline `migrate diff --from-schema/--to-schema --script` recipe in Task 1, never `migrate dev`.
- **`DATABASE_POOL_MAX=1` must be set in this worktree's `.env`** (PGlite supports only one connection) — verify with `cat .env | grep DATABASE_POOL_MAX` before Task 1.
- **Run `npx tsc --noEmit -p tsconfig.json` and `npm run lint` before committing each task.** Run the task's own test file with `npx vitest run <pattern>` before moving to the next task — never the full `npm run test` mid-plan (this project's PGlite dev server is documented to wedge under sustained load; run the full suite once, at the end, restarting `npx prisma dev` first if it wedges).
- **Extend, never duplicate, the pre-wired scaffolding.** `src/lib/stores/cart-store.ts`, `src/hooks/use-add-to-cart.ts`, and `src/components/storefront/layout/cart-badge.tsx` already exist for this exact story — Task 8 replaces/retires the store and fills in the hook; no second cart-state mechanism gets introduced alongside them.

## Review Focus

- **Adding a quantity that pushes a line over `Product.stockQuantity` must be rejected server-side, not just disabled in the UI** — a raw `POST`/`PATCH` request bypassing the UI must get a typed error, never a row with `quantity > stockQuantity`. Pinned by Task 5's repository/service tests.
- **A `PATCH`/`DELETE` on a `CartItem` id that belongs to someone else's cart (guest or authenticated) must 403/404, never mutate it.** This is the one place a client-supplied id touches a mutation — Task 7's route tests exercise it explicitly for both a mismatched guest cookie and a mismatched authenticated user.
- **A tampered guest cookie (wrong signature, or a signature for a different token) must be treated as no-cart, never crash the request or leak another guest's cart.** Task 2's signing-utility tests and Task 7's route tests both cover this — the utility's own unit tests prove the crypto is right, the route tests prove a bad cookie degrades gracefully end-to-end.
- **Merging a guest cart into an authenticated user who already has items must combine matching-product quantities (capped at stock) and append distinct products — not overwrite the account cart, not create duplicate `CartItem` rows for a product both carts had.** Pinned by Task 6's merge tests, which seed a pre-existing account-cart item that overlaps with a guest-cart item.
- **A live price/stock change since the cart line was last read must show up as a flag on the very next read, not silently change the charged total or silently remove the line.** Task 5's revalidation tests assert both the flag and that the line survives with its (now-updated) live price.

---

## Task 1: Prisma schema, `Product.stockQuantity`, and migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_cart/migration.sql`

**Interfaces:**
- Produces: `Cart` model (`id`, `userId?`, `guestToken?`, `items`, `createdAt`, `updatedAt`); `CartItem` model (`id`, `cartId`, `productId`, `quantity`, `unitPriceSnapshot`, `createdAt`, `updatedAt`, `@@unique([cartId, productId])`); `Product.stockQuantity: Int @default(0)`. Every later task's repository queries these directly by name (`prisma.cart`, `prisma.cartItem`).

- [ ] **Step 1: Add `stockQuantity` to `Product`**

In `prisma/schema.prisma`, inside the existing `model Product { ... }` block, add the new field immediately after the existing `inStock` line:

```prisma
  inStock            Boolean       @default(true)
  stockQuantity      Int           @default(0)
```

- [ ] **Step 2: Add the `Cart`/`CartItem` models**

Append at the end of `prisma/schema.prisma` (after the Downloads & Resources section from STORY-023), matching this file's `// --- <Section> (STORY-XXX) ---` convention:

```prisma

// --- Shopping Cart (STORY-024) ---

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

Add the inverse relation to the existing `Product` model, next to its other reverse relations (e.g. near `wishlistItems`):

```prisma
  cartItems           CartItem[]
```

Add the inverse relation to the existing `User` model, next to its other reverse relations (e.g. near `wishlist`):

```prisma
  cart              Cart?
```

- [ ] **Step 3: Push the schema change for local iteration and confirm the generated client compiles**

```bash
npx prisma db push
npx prisma generate
npx tsc --noEmit -p tsconfig.json
```

Expected: `db push` reports the new tables/column created; `tsc` has no new errors.

- [ ] **Step 4: Generate the real migration file via the offline schema-diff recipe (never `migrate dev`)**

```bash
git show HEAD:prisma/schema.prisma > /tmp/schema-before-024.prisma
TS=$(date +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_add_cart"
npx prisma migrate diff --from-schema /tmp/schema-before-024.prisma --to-schema prisma/schema.prisma --script > "prisma/migrations/${TS}_add_cart/migration.sql"
rm /tmp/schema-before-024.prisma
```

Expected `migration.sql` content: `ALTER TABLE "Product" ADD COLUMN "stockQuantity" ...`, `CREATE TABLE "Cart" ...`, `CREATE TABLE "CartItem" ...`, their unique indexes, the `guestToken` index, and the `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` statements.

- [ ] **Step 5: Apply the migration**

Check whether the local `prisma dev` server is already the fresh one this worktree's `.env` expects (it's a single shared server across all worktrees on this machine, per project memory) — if `npx prisma migrate status` already shows other stories' migrations applied, use `npx prisma migrate resolve --applied "<the folder name from Step 4>"` directly (the `db push` in Step 3 already applied this task's DDL live; this just records it). Only if the server is genuinely fresh/empty, apply via the full `create_migrations_table.sql` + raw-SQL + `resolve --applied` sequence documented in `docs/architecture-decisions.md`'s STORY-022 entry.

```bash
npx prisma migrate status
```
Expected: `Database schema is up to date!` with the new migration listed.

```bash
npx prisma db push
```
Expected: `The database is already in sync with the Prisma schema.`

- [ ] **Step 6: Re-seed and add `stockQuantity` to the 4 seeded products**

Before re-seeding, edit `prisma/seed.ts`'s four `productRepository.createProduct({...})` calls (`curryPowder`, `chilliPowder`, `giftSet`, `seasonalSweets` — find them with `grep -n "createProduct(" prisma/seed.ts`) to each add a `stockQuantity` field alongside the existing `rewardPoints` line, e.g.:

```typescript
    rewardPoints: 10,
    stockQuantity: 250,
```

Pick a reasonable positive number per product (e.g. 250 for the curry powder, 250 for chilli powder, 60 for the gift set, 40 for the seasonal sweets pack — lower numbers for bundle/seasonal items is fine, just keep every value comfortably above what a cart e2e test will ever add). Without this, every seeded product defaults to `stockQuantity: 0` and nothing could ever be added to a cart in the seeded demo.

```bash
npx prisma db execute --file tests/unit/truncate-all.sql
npx tsx --env-file=.env prisma/seed.ts
```
Expected: the same `Seed complete: {...}` output the seed script normally produces.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed.ts
git commit -m "feat: add Cart/CartItem models and Product.stockQuantity"
```

---

## Task 2: Guest cart-token signing utility

**Files:**
- Create: `src/lib/cart-token.ts`
- Test: `tests/unit/cart-token.test.ts`

**Interfaces:**
- Consumes: `process.env.AUTH_SECRET` (existing env var, already required by NextAuth).
- Produces: `signCartToken(): { token: string; cookieValue: string }`, `verifyCartCookieValue(cookieValue: string | undefined): string | null` (returns the verified raw token, or `null` for missing/malformed/tampered input — never throws). Task 5's `resolveCartIdentity` and Task 7's routes import both.

- [ ] **Step 1: Write `tests/unit/cart-token.test.ts`**

```typescript
// tests/unit/cart-token.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { signCartToken, verifyCartCookieValue } from "@/lib/cart-token";

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "test-secret-for-cart-token-tests");
});

describe("signCartToken / verifyCartCookieValue", () => {
  it("round-trips: a freshly signed token verifies back to its own raw token", () => {
    const { token, cookieValue } = signCartToken();
    expect(verifyCartCookieValue(cookieValue)).toBe(token);
  });

  it("produces a token with high enough entropy to be effectively unguessable", () => {
    const a = signCartToken();
    const b = signCartToken();
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(24);
  });

  it("rejects a cookie value with a tampered signature", () => {
    const { cookieValue } = signCartToken();
    const [token] = cookieValue.split(".");
    const tampered = `${token}.not-the-real-signature`;
    expect(verifyCartCookieValue(tampered)).toBeNull();
  });

  it("rejects a cookie value with a tampered token but the original signature", () => {
    const { cookieValue } = signCartToken();
    const [, signature] = cookieValue.split(".");
    const tampered = `some-other-token.${signature}`;
    expect(verifyCartCookieValue(tampered)).toBeNull();
  });

  it("rejects undefined, empty, and malformed input without throwing", () => {
    expect(verifyCartCookieValue(undefined)).toBeNull();
    expect(verifyCartCookieValue("")).toBeNull();
    expect(verifyCartCookieValue("no-dot-separator")).toBeNull();
    expect(verifyCartCookieValue("too.many.dots.here")).toBeNull();
  });

  it("rejects a well-formed but never-signed token (forged from scratch)", () => {
    expect(verifyCartCookieValue("aGVsbG8.deadbeefdeadbeefdeadbeefdeadbeef")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run cart-token`
Expected: FAIL — `Cannot find module '@/lib/cart-token'` (or similar; the file doesn't exist yet).

- [ ] **Step 3: Write `src/lib/cart-token.ts`**

```typescript
import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signs a new, high-entropy guest cart token with AUTH_SECRET (HMAC-SHA256)
 * — the first hand-set (non-NextAuth) cookie in this codebase. No new
 * secret to provision: AUTH_SECRET is already required by NextAuth.
 * `token` is the raw value stored as Cart.guestToken (the DB lookup key);
 * `cookieValue` (`token.signature`) is what actually goes in the cookie —
 * never store cookieValue itself as a lookup key, always verify first.
 */
export function signCartToken(): { token: string; cookieValue: string } {
  const token = randomBytes(24).toString("base64url");
  const signature = sign(token);
  return { token, cookieValue: `${token}.${signature}` };
}

/**
 * Verifies a cookie value read back from the request. Returns the raw
 * token (safe to use as a Cart.guestToken lookup key) if the signature is
 * valid, or null for anything else — missing, malformed, tampered token,
 * tampered signature, or a token that was never actually signed by this
 * server. Never throws: a bad cookie is always "start a new guest cart",
 * not a request failure.
 */
export function verifyCartCookieValue(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;
  const [token, signature] = parts;
  if (!token || !signature) return null;

  const expected = sign(token);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== actualBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, actualBuffer)) return null;

  return token;
}

function sign(token: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(token).digest("hex");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run cart-token`
Expected: PASS (6 tests). No `prisma dev` needed — this file has no DB dependency.

- [ ] **Step 5: `tsc`/lint**

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/cart-token.ts tests/unit/cart-token.test.ts
git commit -m "feat: add signed guest cart-token utility"
```

---

## Task 3: Shared types and Zod validation schemas

**Files:**
- Create: `src/types/cart.ts`
- Create: `src/validation/cart.schema.ts`

**Interfaces:**
- Consumes: nothing (leaf files).
- Produces: `CartLineItem`, `CartSummary` (from `types/cart.ts`); `addCartItemSchema`, `AddCartItemInput`, `updateCartItemSchema`, `UpdateCartItemInput` (from `validation/cart.schema.ts`). Tasks 4–9 import from these two files.

- [ ] **Step 1: Write `src/types/cart.ts`**

```typescript
/**
 * Cart types shared by server and client code (STORY-024). Keep this file
 * free of server-only imports (Prisma, services): client components
 * import from it directly.
 */

export interface CartLineItem {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  imageSrc: string;
  imageAlt: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  lineTotal: number;
  rewardPointsEarned: number;
  /** True exactly once, on the first read after the live price differs from the last-seen snapshot. */
  priceChanged: boolean;
  /** The product is no longer Published — the line can't be purchased as-is. */
  unavailable: boolean;
  /** The requested quantity now exceeds Product.stockQuantity; availableQuantity is the current on-hand number. */
  quantityCapped: boolean;
  availableQuantity: number;
}

export interface CartSummary {
  items: CartLineItem[];
  itemCount: number;
  subtotal: number;
  currency: string;
  rewardPointsEarned: number;
}
```

- [ ] **Step 2: Write `src/validation/cart.schema.ts`**

```typescript
import { z } from "zod";

export const addCartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number({ error: "Quantity is required" }).int().positive(),
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z.object({
  quantity: z.number({ error: "Quantity is required" }).int().positive(),
});

export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
```

- [ ] **Step 3: `tsc`/lint**

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/types/cart.ts src/validation/cart.schema.ts
git commit -m "feat: add cart types and validation schemas"
```

---

## Task 4: `cart.errors.ts` and `cart.repository.ts`

**Files:**
- Create: `src/services/cart.errors.ts`
- Create: `src/repositories/cart.repository.ts`
- Test: `tests/unit/cart-repository.test.ts`

**Interfaces:**
- Consumes: `Prisma` from `@/generated/prisma/client` (Task 1).
- Produces: error classes `CartServiceError`, `CartItemNotFoundError`, `CartItemForbiddenError`, `StockExceededError`, `ProductUnavailableError` (each with a `.code`); repository functions `findCartByUserId`, `findCartByGuestToken`, `createGuestCart`, `createUserCart`, `findCartItemById`, `upsertCartItem`, `updateCartItemQuantity`, `deleteCartItem`, `listCartItemsWithProduct`, `deleteCart`, and type `CartItemWithProduct`. Task 5's service imports all of these.

- [ ] **Step 1: Write `tests/unit/cart-repository.test.ts`**

```typescript
// tests/unit/cart-repository.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import {
  createGuestCart,
  createUserCart,
  deleteCart,
  deleteCartItem,
  findCartByGuestToken,
  findCartByUserId,
  findCartItemById,
  listCartItemsWithProduct,
  updateCartItemQuantity,
  upsertCartItem,
} from "@/repositories/cart.repository";

let sequence = 0;

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `cart-repo-${sequence}@test.com` } });
}

async function makeProduct(overrides: Record<string, unknown> = {}) {
  sequence += 1;
  return createProduct({
    sku: `CART-REPO-SKU-${sequence}`,
    slug: `cart-repo-product-${sequence}`,
    name: `Cart Repo Product ${sequence}`,
    status: "Published",
    stockQuantity: 100,
    ...overrides,
  });
}

afterEach(async () => {
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany({ where: { sku: { startsWith: "CART-REPO-SKU-" } } });
  await prisma.user.deleteMany({ where: { email: { contains: "cart-repo-" } } });
});

describe("createUserCart / findCartByUserId", () => {
  it("creates and finds a cart by userId", async () => {
    const user = await makeUser();
    const cart = await createUserCart(user.id);
    expect(await findCartByUserId(user.id)).toMatchObject({ id: cart.id, userId: user.id });
  });

  it("returns null for a user with no cart", async () => {
    const user = await makeUser();
    expect(await findCartByUserId(user.id)).toBeNull();
  });
});

describe("createGuestCart / findCartByGuestToken", () => {
  it("creates and finds a cart by guestToken", async () => {
    const cart = await createGuestCart("test-guest-token-1");
    expect(await findCartByGuestToken("test-guest-token-1")).toMatchObject({ id: cart.id });
  });

  it("returns null for an unknown guestToken", async () => {
    expect(await findCartByGuestToken("does-not-exist")).toBeNull();
  });
});

describe("upsertCartItem", () => {
  it("creates a new line item", async () => {
    const user = await makeUser();
    const cart = await createUserCart(user.id);
    const product = await makeProduct();

    const item = await upsertCartItem(cart.id, product.id, 2, product.standardPrices?.[0]?.price ?? "10.00");
    expect(item.quantity).toBe(2);
  });

  it("adding the same product again increments quantity rather than duplicating the row", async () => {
    const user = await makeUser();
    const cart = await createUserCart(user.id);
    const product = await makeProduct();

    await upsertCartItem(cart.id, product.id, 2, "10.00");
    const second = await upsertCartItem(cart.id, product.id, 3, "10.00");

    expect(second.quantity).toBe(5);
    const items = await listCartItemsWithProduct(cart.id);
    expect(items).toHaveLength(1);
  });
});

describe("updateCartItemQuantity / deleteCartItem", () => {
  it("updates quantity", async () => {
    const user = await makeUser();
    const cart = await createUserCart(user.id);
    const product = await makeProduct();
    const item = await upsertCartItem(cart.id, product.id, 1, "10.00");

    const updated = await updateCartItemQuantity(item.id, 5);
    expect(updated.quantity).toBe(5);
  });

  it("deletes a line item", async () => {
    const user = await makeUser();
    const cart = await createUserCart(user.id);
    const product = await makeProduct();
    const item = await upsertCartItem(cart.id, product.id, 1, "10.00");

    await deleteCartItem(item.id);
    expect(await findCartItemById(item.id)).toBeNull();
  });
});

describe("listCartItemsWithProduct", () => {
  it("returns every line item with its joined product", async () => {
    const user = await makeUser();
    const cart = await createUserCart(user.id);
    const productA = await makeProduct();
    const productB = await makeProduct();
    await upsertCartItem(cart.id, productA.id, 1, "10.00");
    await upsertCartItem(cart.id, productB.id, 2, "20.00");

    const items = await listCartItemsWithProduct(cart.id);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.product.id).sort()).toEqual([productA.id, productB.id].sort());
  });
});

describe("deleteCart", () => {
  it("deletes the cart and cascades its items", async () => {
    const user = await makeUser();
    const cart = await createUserCart(user.id);
    const product = await makeProduct();
    await upsertCartItem(cart.id, product.id, 1, "10.00");

    await deleteCart(cart.id);

    expect(await findCartByUserId(user.id)).toBeNull();
    expect(await prisma.cartItem.count({ where: { cartId: cart.id } })).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run cart-repository`
Expected: FAIL — `Cannot find module '@/repositories/cart.repository'`. Ensure `npx prisma dev` is running first.

- [ ] **Step 3: Write `src/services/cart.errors.ts`**

```typescript
/**
 * Typed errors thrown by cart.service.ts. Route handlers map `code` to an
 * HTTP status in one place (src/lib/api/cart-responses.ts) instead of
 * matching on message strings.
 */
export type CartErrorCode = "not_found" | "forbidden" | "stock_exceeded" | "unavailable";

export class CartServiceError extends Error {
  readonly code: CartErrorCode;

  constructor(code: CartErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = new.target.name;
  }
}

export class CartItemNotFoundError extends CartServiceError {
  constructor() {
    super("not_found", "Cart item not found");
  }
}

export class CartItemForbiddenError extends CartServiceError {
  constructor() {
    super("forbidden", "This cart item doesn't belong to your cart");
  }
}

export class StockExceededError extends CartServiceError {
  constructor(readonly availableQuantity: number) {
    super("stock_exceeded", `Only ${availableQuantity} left in stock`);
  }
}

export class ProductUnavailableError extends CartServiceError {
  constructor() {
    super("unavailable", "This product is no longer available");
  }
}
```

- [ ] **Step 4: Write `src/repositories/cart.repository.ts`**

```typescript
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

const withProduct = { product: true } satisfies Prisma.CartItemInclude;

export type CartItemWithProduct = Prisma.CartItemGetPayload<{ include: typeof withProduct }>;

export function findCartByUserId(userId: string) {
  return prisma.cart.findUnique({ where: { userId } });
}

export function findCartByGuestToken(guestToken: string) {
  return prisma.cart.findUnique({ where: { guestToken } });
}

export function createUserCart(userId: string) {
  return prisma.cart.create({ data: { userId } });
}

export function createGuestCart(guestToken: string) {
  return prisma.cart.create({ data: { guestToken } });
}

export function findCartItemById(id: string) {
  return prisma.cartItem.findUnique({ where: { id } });
}

/**
 * Adding a product already in the cart increments its quantity (matching
 * the `@@unique([cartId, productId])` de-dup guard) rather than creating a
 * second row. `unitPriceSnapshot` is always overwritten to the caller's
 * current resolved price — on a first add that's simply the price being
 * recorded; on an increment, cart.service.ts has already re-resolved the
 * live price before calling this, so the snapshot never goes stale here.
 */
export async function upsertCartItem(
  cartId: string,
  productId: string,
  quantityDelta: number,
  unitPriceSnapshot: string,
): Promise<Prisma.CartItemGetPayload<object>> {
  const existing = await prisma.cartItem.findUnique({ where: { cartId_productId: { cartId, productId } } });
  if (existing) {
    return prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantityDelta, unitPriceSnapshot },
    });
  }
  return prisma.cartItem.create({
    data: { cartId, productId, quantity: quantityDelta, unitPriceSnapshot },
  });
}

export function updateCartItemQuantity(id: string, quantity: number) {
  return prisma.cartItem.update({ where: { id }, data: { quantity } });
}

export function updateCartItemSnapshot(id: string, unitPriceSnapshot: string) {
  return prisma.cartItem.update({ where: { id }, data: { unitPriceSnapshot } });
}

export function deleteCartItem(id: string) {
  return prisma.cartItem.delete({ where: { id } });
}

export function listCartItemsWithProduct(cartId: string): Promise<CartItemWithProduct[]> {
  return prisma.cartItem.findMany({
    where: { cartId },
    include: withProduct,
    orderBy: { createdAt: "asc" },
  });
}

export function deleteCart(id: string) {
  return prisma.cart.delete({ where: { id } });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run cart-repository`
Expected: PASS (all tests).

- [ ] **Step 6: `tsc`/lint**

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint
```

- [ ] **Step 7: Commit**

```bash
git add src/services/cart.errors.ts src/repositories/cart.repository.ts tests/unit/cart-repository.test.ts
git commit -m "feat: add cart repository and typed errors"
```

---

## Task 5: `cart.service.ts` — identity resolution, add/update/remove, revalidation

**Files:**
- Create: `src/services/cart.service.ts`
- Test: `tests/unit/cart-service.test.ts`

**Interfaces:**
- Consumes: everything Task 4 produces; `signCartToken`/`verifyCartCookieValue` (Task 2); `resolvePrice` from `@/services/pricing.service` (existing); `findProductById` from `@/repositories/product.repository` (existing); `CartLineItem`/`CartSummary` (Task 3).
- Produces: `CART_COOKIE_NAME` (constant, `"oristor-cart-token"`), `resolveCartIdentity(userId: string | null, guestCookieValue: string | undefined): Promise<{ cart: Prisma.CartGetPayload<object>; newCookieValue: string | null }>`, `getCart`, `addItem`, `updateItemQuantity`, `removeItem`. Task 6's merge function and Task 7's routes import all of these.

- [ ] **Step 1: Write `tests/unit/cart-service.test.ts`**

```typescript
// tests/unit/cart-service.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import {
  CartItemForbiddenError,
  CartItemNotFoundError,
  ProductUnavailableError,
  StockExceededError,
} from "@/services/cart.errors";
import {
  addItem,
  getCart,
  removeItem,
  resolveCartIdentity,
  updateItemQuantity,
} from "@/services/cart.service";

let sequence = 0;

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `cart-svc-${sequence}@test.com` } });
}

async function makeProduct(overrides: Record<string, unknown> = {}) {
  sequence += 1;
  const product = await createProduct({
    sku: `CART-SVC-SKU-${sequence}`,
    slug: `cart-svc-product-${sequence}`,
    name: `Cart Svc Product ${sequence}`,
    status: "Published",
    stockQuantity: 10,
    images: { create: [{ url: "/images/products/export/curry-powder.webp", altText: "Test", sortOrder: 0, isPrimary: true }] },
    ...overrides,
  });
  await prisma.standardPrice.create({ data: { productId: product.id, price: "25.00" } });
  return product;
}

afterEach(async () => {
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.standardPrice.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany({ where: { sku: { startsWith: "CART-SVC-SKU-" } } });
  await prisma.user.deleteMany({ where: { email: { contains: "cart-svc-" } } });
});

describe("resolveCartIdentity", () => {
  it("creates a new guest cart and returns a cookie value when the caller has no session and no cookie", async () => {
    const { cart, newCookieValue } = await resolveCartIdentity(null, undefined);
    expect(cart.guestToken).not.toBeNull();
    expect(newCookieValue).not.toBeNull();
  });

  it("reuses an existing guest cart for a valid cookie, issuing no new cookie", async () => {
    const first = await resolveCartIdentity(null, undefined);
    const second = await resolveCartIdentity(null, first.newCookieValue ?? undefined);
    expect(second.cart.id).toBe(first.cart.id);
    expect(second.newCookieValue).toBeNull();
  });

  it("treats a tampered cookie as no guest cart and creates a fresh one", async () => {
    const { cart: original } = await resolveCartIdentity(null, undefined);
    const { cart: fresh } = await resolveCartIdentity(null, "tampered.cookie-value");
    expect(fresh.id).not.toBe(original.id);
  });

  it("creates a new cart for an authenticated user with none yet", async () => {
    const user = await makeUser();
    const { cart, newCookieValue } = await resolveCartIdentity(user.id, undefined);
    expect(cart.userId).toBe(user.id);
    expect(newCookieValue).toBeNull();
  });

  it("reuses an authenticated user's existing cart", async () => {
    const user = await makeUser();
    const first = await resolveCartIdentity(user.id, undefined);
    const second = await resolveCartIdentity(user.id, undefined);
    expect(second.cart.id).toBe(first.cart.id);
  });
});

describe("addItem / getCart", () => {
  it("adds a product and the cart summary reflects price, quantity, and reward points", async () => {
    const user = await makeUser();
    const product = await makeProduct({ rewardPoints: 5 });

    await addItem(user.id, null, product.id, 2);
    const summary = await getCart(user.id, null);

    expect(summary.items).toHaveLength(1);
    expect(summary.items[0]).toMatchObject({ productId: product.id, quantity: 2, unitPrice: 25, lineTotal: 50 });
    expect(summary.itemCount).toBe(2);
    expect(summary.subtotal).toBe(50);
    expect(summary.rewardPointsEarned).toBe(10);
  });

  it("adding the same product twice combines quantity into one line", async () => {
    const user = await makeUser();
    const product = await makeProduct();

    await addItem(user.id, null, product.id, 1);
    await addItem(user.id, null, product.id, 2);
    const summary = await getCart(user.id, null);

    expect(summary.items).toHaveLength(1);
    expect(summary.items[0]?.quantity).toBe(3);
  });

  it("rejects adding more than stockQuantity", async () => {
    const user = await makeUser();
    const product = await makeProduct({ stockQuantity: 3 });

    await expect(addItem(user.id, null, product.id, 5)).rejects.toThrow(StockExceededError);
  });

  it("rejects adding a non-Published product", async () => {
    const user = await makeUser();
    const product = await makeProduct({ status: "Draft" });

    await expect(addItem(user.id, null, product.id, 1)).rejects.toThrow(ProductUnavailableError);
  });

  it("works identically for a guest identity (no userId)", async () => {
    const product = await makeProduct();
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    const summary = await getCart(null, newCookieValue ?? undefined);
    expect(summary.items).toHaveLength(1);
  });
});

describe("updateItemQuantity", () => {
  it("updates quantity", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    await addItem(user.id, null, product.id, 1);
    const summary = await getCart(user.id, null);
    const itemId = summary.items[0]!.id;

    await updateItemQuantity(user.id, null, itemId, 4);
    const refreshed = await getCart(user.id, null);
    expect(refreshed.items[0]?.quantity).toBe(4);
  });

  it("rejects updating past stockQuantity", async () => {
    const user = await makeUser();
    const product = await makeProduct({ stockQuantity: 3 });
    await addItem(user.id, null, product.id, 1);
    const summary = await getCart(user.id, null);
    const itemId = summary.items[0]!.id;

    await expect(updateItemQuantity(user.id, null, itemId, 5)).rejects.toThrow(StockExceededError);
  });

  it("rejects updating a cart item that doesn't exist", async () => {
    const user = await makeUser();
    await expect(updateItemQuantity(user.id, null, "does-not-exist", 1)).rejects.toThrow(CartItemNotFoundError);
  });

  it("rejects updating another cart's item", async () => {
    const owner = await makeUser();
    const intruder = await makeUser();
    const product = await makeProduct();
    await addItem(owner.id, null, product.id, 1);
    const summary = await getCart(owner.id, null);
    const itemId = summary.items[0]!.id;

    await expect(updateItemQuantity(intruder.id, null, itemId, 2)).rejects.toThrow(CartItemForbiddenError);
  });
});

describe("removeItem", () => {
  it("removes a line item", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    await addItem(user.id, null, product.id, 1);
    const summary = await getCart(user.id, null);
    const itemId = summary.items[0]!.id;

    await removeItem(user.id, null, itemId);
    const refreshed = await getCart(user.id, null);
    expect(refreshed.items).toHaveLength(0);
  });

  it("rejects removing another cart's item", async () => {
    const owner = await makeUser();
    const intruder = await makeUser();
    const product = await makeProduct();
    await addItem(owner.id, null, product.id, 1);
    const summary = await getCart(owner.id, null);
    const itemId = summary.items[0]!.id;

    await expect(removeItem(intruder.id, null, itemId)).rejects.toThrow(CartItemForbiddenError);
  });
});

describe("revalidation on read", () => {
  it("flags priceChanged exactly once, then reflects the new price on the next read", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    await addItem(user.id, null, product.id, 1);

    // Price moves after the item was added.
    await prisma.standardPrice.create({ data: { productId: product.id, price: "40.00" } });

    const firstRead = await getCart(user.id, null);
    expect(firstRead.items[0]?.priceChanged).toBe(true);
    expect(firstRead.items[0]?.unitPrice).toBe(40);

    const secondRead = await getCart(user.id, null);
    expect(secondRead.items[0]?.priceChanged).toBe(false);
    expect(secondRead.items[0]?.unitPrice).toBe(40);
  });

  it("flags quantityCapped when stock drops below the cart's quantity, without changing the stored quantity", async () => {
    const user = await makeUser();
    const product = await makeProduct({ stockQuantity: 10 });
    await addItem(user.id, null, product.id, 5);

    await prisma.product.update({ where: { id: product.id }, data: { stockQuantity: 2 } });

    const summary = await getCart(user.id, null);
    expect(summary.items[0]?.quantityCapped).toBe(true);
    expect(summary.items[0]?.availableQuantity).toBe(2);
    expect(summary.items[0]?.quantity).toBe(5); // unchanged — customer adjusts themselves
  });

  it("flags unavailable when the product is no longer Published, without removing the line", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    await addItem(user.id, null, product.id, 1);

    await prisma.product.update({ where: { id: product.id }, data: { status: "Draft" } });

    const summary = await getCart(user.id, null);
    expect(summary.items[0]?.unavailable).toBe(true);
    expect(summary.items).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run cart-service`
Expected: FAIL — `Cannot find module '@/services/cart.service'`.

- [ ] **Step 3: Write `src/services/cart.service.ts`**

```typescript
import type { Prisma } from "@/generated/prisma/client";
import { signCartToken, verifyCartCookieValue } from "@/lib/cart-token";
import { findProductById } from "@/repositories/product.repository";
import * as cartRepository from "@/repositories/cart.repository";
import type { CartItemWithProduct } from "@/repositories/cart.repository";
import {
  CartItemForbiddenError,
  CartItemNotFoundError,
  ProductUnavailableError,
  StockExceededError,
} from "@/services/cart.errors";
import { resolvePrice } from "@/services/pricing.service";
import type { CartLineItem, CartSummary } from "@/types/cart";

export const CART_COOKIE_NAME = "oristor-cart-token";

interface CartIdentityResult {
  cart: Prisma.CartGetPayload<object>;
  /** Set only when a brand-new guest cart was just created — the caller (a route handler) must Set-Cookie this. */
  newCookieValue: string | null;
}

/**
 * Resolves which Cart a request's identity maps to, creating one if
 * needed. An authenticated userId always wins over a guest cookie (a
 * logged-in visitor's cart is their account cart, never a lingering guest
 * one — the guest cart, if any, is handled by the merge flow, Task 6).
 * A cookie that fails signature verification is treated exactly like no
 * cookie at all: a fresh guest cart is created, never an error.
 */
export async function resolveCartIdentity(
  userId: string | null,
  guestCookieValue: string | undefined,
): Promise<CartIdentityResult> {
  if (userId) {
    const existing = await cartRepository.findCartByUserId(userId);
    if (existing) return { cart: existing, newCookieValue: null };
    const created = await cartRepository.createUserCart(userId);
    return { cart: created, newCookieValue: null };
  }

  const verifiedToken = verifyCartCookieValue(guestCookieValue);
  if (verifiedToken) {
    const existing = await cartRepository.findCartByGuestToken(verifiedToken);
    if (existing) return { cart: existing, newCookieValue: null };
    // Verified token with no matching row (e.g. the row was deleted by a
    // merge) — fall through to creating a fresh guest cart below.
  }

  const { token, cookieValue } = signCartToken();
  const created = await cartRepository.createGuestCart(token);
  return { cart: created, newCookieValue: cookieValue };
}

async function requireAvailableProduct(productId: string, requestedQuantity: number) {
  const product = await findProductById(productId);
  if (!product || product.status !== "Published") throw new ProductUnavailableError();
  if (requestedQuantity > product.stockQuantity) throw new StockExceededError(product.stockQuantity);
  return product;
}

function toLineItem(item: CartItemWithProduct, resolvedUnitPrice: number, currency: string, priceChanged: boolean): CartLineItem {
  const primaryImage = item.product.images as unknown as { url: string; altText: string | null }[] | undefined;
  const quantityCapped = item.quantity > item.product.stockQuantity;
  return {
    id: item.id,
    productId: item.product.id,
    productName: item.product.name,
    productSlug: item.product.slug,
    imageSrc: primaryImage?.[0]?.url ?? "",
    imageAlt: primaryImage?.[0]?.altText ?? item.product.name,
    quantity: item.quantity,
    unitPrice: resolvedUnitPrice,
    currency,
    lineTotal: Math.round(resolvedUnitPrice * item.quantity * 100) / 100,
    rewardPointsEarned: item.product.rewardPoints * item.quantity,
    priceChanged,
    unavailable: item.product.status !== "Published",
    quantityCapped,
    availableQuantity: item.product.stockQuantity,
  };
}

/**
 * Re-resolves the live price for every line, flags the ones that moved
 * since the stored snapshot, THEN overwrites the snapshot — so the
 * returned totals are always current (never stale) while the caller still
 * sees a one-time notice for exactly the read where it changed. See
 * design spec decision #6.
 */
async function buildSummary(cartId: string, items: CartItemWithProduct[]): Promise<CartSummary> {
  const lineItems: CartLineItem[] = [];
  for (const item of items) {
    const resolved = await resolvePrice({ productId: item.productId, customerGroup: "Retail", quantity: item.quantity });
    const liveUnitPrice = resolved?.price.toNumber() ?? item.unitPriceSnapshot.toNumber();
    const currency = resolved?.currency ?? "LKR";
    const priceChanged = liveUnitPrice !== item.unitPriceSnapshot.toNumber();
    if (priceChanged) {
      await cartRepository.updateCartItemSnapshot(item.id, liveUnitPrice.toFixed(2));
    }
    lineItems.push(toLineItem(item, liveUnitPrice, currency, priceChanged));
  }

  return {
    items: lineItems,
    itemCount: lineItems.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: Math.round(lineItems.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100,
    currency: lineItems[0]?.currency ?? "LKR",
    rewardPointsEarned: lineItems.reduce((sum, item) => sum + item.rewardPointsEarned, 0),
  };
}

export async function getCart(userId: string | null, guestCookieValue: string | undefined): Promise<CartSummary> {
  const { cart } = await resolveCartIdentity(userId, guestCookieValue);
  const items = await cartRepository.listCartItemsWithProduct(cart.id);
  return buildSummary(cart.id, items);
}

export async function addItem(
  userId: string | null,
  guestCookieValue: string | undefined,
  productId: string,
  quantity: number,
): Promise<CartIdentityResult> {
  const identity = await resolveCartIdentity(userId, guestCookieValue);
  const existingItem = await cartRepository.listCartItemsWithProduct(identity.cart.id).then((items) => items.find((i) => i.productId === productId));
  const totalRequested = (existingItem?.quantity ?? 0) + quantity;

  const product = await requireAvailableProduct(productId, totalRequested);
  const resolved = await resolvePrice({ productId, customerGroup: "Retail", quantity: totalRequested });
  const unitPrice = resolved?.price.toFixed(2) ?? "0.00";

  await cartRepository.upsertCartItem(identity.cart.id, product.id, quantity, unitPrice);
  return identity;
}

async function requireOwnCartItem(userId: string | null, guestCookieValue: string | undefined, itemId: string) {
  const { cart } = await resolveCartIdentity(userId, guestCookieValue);
  const item = await cartRepository.findCartItemById(itemId);
  if (!item) throw new CartItemNotFoundError();
  if (item.cartId !== cart.id) throw new CartItemForbiddenError();
  return item;
}

export async function updateItemQuantity(
  userId: string | null,
  guestCookieValue: string | undefined,
  itemId: string,
  quantity: number,
): Promise<void> {
  const item = await requireOwnCartItem(userId, guestCookieValue, itemId);
  await requireAvailableProduct(item.productId, quantity);
  const resolved = await resolvePrice({ productId: item.productId, customerGroup: "Retail", quantity });
  await cartRepository.updateCartItemQuantity(itemId, quantity);
  if (resolved) await cartRepository.updateCartItemSnapshot(itemId, resolved.price.toFixed(2));
}

export async function removeItem(userId: string | null, guestCookieValue: string | undefined, itemId: string): Promise<void> {
  await requireOwnCartItem(userId, guestCookieValue, itemId);
  await cartRepository.deleteCartItem(itemId);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run cart-service`
Expected: PASS (all tests).

- [ ] **Step 5: `tsc`/lint**

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint
```

Note: `toLineItem`'s `item.product.images` cast is a placeholder for whatever shape `withProduct`'s plain `{ product: true }` include actually returns (a full `Product` row has no `images` relation loaded by a bare `include: { product: true }` — Prisma only loads what's explicitly included). If `tsc`/the test reveals `item.product` has no `images` property at all, change `withProduct` in `cart.repository.ts` (Task 4) to `{ product: { include: { images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 } } } }` and update `CartItemWithProduct`'s consumers accordingly — re-run both this task's and Task 4's tests after that change.

- [ ] **Step 6: Commit**

```bash
git add src/services/cart.service.ts tests/unit/cart-service.test.ts
git commit -m "feat: add cart service (identity resolution, add/update/remove, revalidation)"
```

---

## Task 6: `cart.service.ts` — merge

**Files:**
- Modify: `src/services/cart.service.ts`
- Test: `tests/unit/cart-service.test.ts` (append)

**Interfaces:**
- Consumes: everything Task 5 produces.
- Produces: `mergeGuestCartIntoUser(userId: string, guestCookieValue: string | undefined): Promise<void>`. Task 8's merge route imports this.

- [ ] **Step 1: Append the failing tests to `tests/unit/cart-service.test.ts`**

```typescript
describe("mergeGuestCartIntoUser", () => {
  it("merges a guest cart's items into a user with no existing cart", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const { newCookieValue } = await addItem(null, undefined, product.id, 2);

    await mergeGuestCartIntoUser(user.id, newCookieValue ?? undefined);

    const summary = await getCart(user.id, null);
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0]?.quantity).toBe(2);
  });

  it("combines quantities for a product both carts already have, capped at stock", async () => {
    const user = await makeUser();
    const product = await makeProduct({ stockQuantity: 4 });
    await addItem(user.id, null, product.id, 2);
    const { newCookieValue } = await addItem(null, undefined, product.id, 3);

    await mergeGuestCartIntoUser(user.id, newCookieValue ?? undefined);

    const summary = await getCart(user.id, null);
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0]?.quantity).toBe(4); // 2 + 3 = 5, capped at stockQuantity 4
  });

  it("appends a distinct product the guest cart had that the account cart didn't", async () => {
    const user = await makeUser();
    const accountProduct = await makeProduct();
    const guestProduct = await makeProduct();
    await addItem(user.id, null, accountProduct.id, 1);
    const { newCookieValue } = await addItem(null, undefined, guestProduct.id, 1);

    await mergeGuestCartIntoUser(user.id, newCookieValue ?? undefined);

    const summary = await getCart(user.id, null);
    expect(summary.items.map((i) => i.productId).sort()).toEqual([accountProduct.id, guestProduct.id].sort());
  });

  it("deletes the guest cart after a successful merge", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    const guestToken = verifyCartCookieValue(newCookieValue ?? undefined);

    await mergeGuestCartIntoUser(user.id, newCookieValue ?? undefined);

    expect(await prisma.cart.findUnique({ where: { guestToken: guestToken! } })).toBeNull();
  });

  it("is a no-op when there is no valid guest cookie", async () => {
    const user = await makeUser();
    await expect(mergeGuestCartIntoUser(user.id, undefined)).resolves.not.toThrow();
    expect((await getCart(user.id, null)).items).toHaveLength(0);
  });
});
```

Also add `mergeGuestCartIntoUser` and `verifyCartCookieValue` to the test file's import list (the latter already exists in `@/lib/cart-token`, used here to derive the raw token from a cookie value for the "guest cart deleted" assertion):

```typescript
import { verifyCartCookieValue } from "@/lib/cart-token";
```

and add `mergeGuestCartIntoUser` to the existing `@/services/cart.service` import.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run cart-service`
Expected: FAIL — `mergeGuestCartIntoUser is not a function` (the 5 new tests fail; all prior tests still pass).

- [ ] **Step 3: Add `mergeGuestCartIntoUser` to `src/services/cart.service.ts`**

```typescript
/**
 * Merges a guest cart (identified by the still-present guest cookie) into
 * the now-authenticated user's cart. Matching products combine quantity
 * (capped at current stock — never silently over-adds past what's
 * available); distinct products are appended. The guest Cart row is
 * deleted only after the merge's writes complete, so a failure leaves the
 * guest cart/cookie intact for a retry on the next session transition
 * (CartMergeSync, Task 9, clears the cookie client-side only after this
 * call succeeds).
 */
export async function mergeGuestCartIntoUser(userId: string, guestCookieValue: string | undefined): Promise<void> {
  const guestToken = verifyCartCookieValue(guestCookieValue);
  if (!guestToken) return;

  const guestCart = await cartRepository.findCartByGuestToken(guestToken);
  if (!guestCart) return;

  const guestItems = await cartRepository.listCartItemsWithProduct(guestCart.id);
  if (guestItems.length === 0) {
    await cartRepository.deleteCart(guestCart.id);
    return;
  }

  const { cart: userCart } = await resolveCartIdentity(userId, undefined);
  const userItems = await cartRepository.listCartItemsWithProduct(userCart.id);
  const userItemByProductId = new Map(userItems.map((item) => [item.productId, item]));

  for (const guestItem of guestItems) {
    const existing = userItemByProductId.get(guestItem.productId);
    const combinedQuantity = (existing?.quantity ?? 0) + guestItem.quantity;
    const product = await findProductById(guestItem.productId);
    if (!product || product.status !== "Published") continue; // dropped, same convention addItem's requireAvailableProduct enforces
    const cappedQuantity = Math.min(combinedQuantity, product.stockQuantity);
    if (cappedQuantity <= 0) continue;

    const resolved = await resolvePrice({ productId: guestItem.productId, customerGroup: "Retail", quantity: cappedQuantity });
    const unitPrice = resolved?.price.toFixed(2) ?? guestItem.unitPriceSnapshot.toFixed(2);

    if (existing) {
      await cartRepository.updateCartItemQuantity(existing.id, cappedQuantity);
      await cartRepository.updateCartItemSnapshot(existing.id, unitPrice);
    } else {
      await cartRepository.upsertCartItem(userCart.id, guestItem.productId, cappedQuantity, unitPrice);
    }
  }

  await cartRepository.deleteCart(guestCart.id);
}
```

Add the `verifyCartCookieValue` import to `cart.service.ts`'s existing `@/lib/cart-token` import line (it already imports `signCartToken` from there).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run cart-service`
Expected: PASS (all tests, prior + new).

- [ ] **Step 5: `tsc`/lint**

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add src/services/cart.service.ts tests/unit/cart-service.test.ts
git commit -m "feat: add guest-to-account cart merge"
```

---

## Task 7: `cart-responses.ts` and the cart API routes (except merge)

**Files:**
- Create: `src/lib/api/cart-responses.ts`
- Create: `src/app/api/cart/route.ts`
- Create: `src/app/api/cart/items/route.ts`
- Create: `src/app/api/cart/items/[id]/route.ts`
- Test: `tests/unit/cart-routes.test.ts`

**Interfaces:**
- Consumes: `serverErrorResponse` from `@/lib/api/responses` (existing); everything Task 5/6 produce; `addCartItemSchema`/`updateCartItemSchema` (Task 3); `CART_COOKIE_NAME` (Task 5).
- Produces: `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/[id]`, `DELETE /api/cart/items/[id]`; `readCartCookie`/`setCartCookie` (from `src/lib/api/cart-cookie.ts` — **not** from a `route.ts` file: Next.js App Router only recognizes HTTP-method exports and a small fixed set of config constants from a route file, so a shared helper must live in a plain module). No later task depends on the route modules directly — the frontend (Task 9) talks to them via `fetch`; Task 8's merge route imports `readCartCookie` from `cart-cookie.ts`, same as every route in this task.

- [ ] **Step 1: Write `src/lib/api/cart-cookie.ts`**

```typescript
import type { NextResponse } from "next/server";

import { CART_COOKIE_NAME } from "@/services/cart.service";

export function readCartCookie(request: Request): string | undefined {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`${CART_COOKIE_NAME}=([^;]+)`));
  return match?.[1];
}

export function setCartCookie(response: NextResponse, cookieValue: string): void {
  response.cookies.set(CART_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
```

- [ ] **Step 2: Write `src/lib/api/cart-responses.ts`**

```typescript
import { NextResponse } from "next/server";

import { CartServiceError, type CartErrorCode } from "@/services/cart.errors";
import { StockExceededError } from "@/services/cart.errors";

const statusByCode: Record<CartErrorCode, number> = {
  not_found: 404,
  forbidden: 403,
  stock_exceeded: 409,
  unavailable: 409,
};

export function cartErrorResponse(error: unknown) {
  if (error instanceof StockExceededError) {
    return NextResponse.json({ error: error.message, availableQuantity: error.availableQuantity }, { status: 409 });
  }
  if (error instanceof CartServiceError) {
    return NextResponse.json({ error: error.message }, { status: statusByCode[error.code] });
  }
  throw error;
}
```

- [ ] **Step 3: Write `tests/unit/cart-routes.test.ts`**

```typescript
// tests/unit/cart-routes.test.ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { GET as getCartRoute } from "@/app/api/cart/route";
import { POST as postCartItem } from "@/app/api/cart/items/route";
import { PATCH as patchCartItem, DELETE as deleteCartItem } from "@/app/api/cart/items/[id]/route";
import { CART_COOKIE_NAME } from "@/services/cart.service";

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

let sequence = 0;

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `cart-route-${sequence}@test.com` } });
}

async function makeProduct(overrides: Record<string, unknown> = {}) {
  sequence += 1;
  const product = await createProduct({
    sku: `CART-ROUTE-SKU-${sequence}`,
    slug: `cart-route-product-${sequence}`,
    name: `Cart Route Product ${sequence}`,
    status: "Published",
    stockQuantity: 10,
    ...overrides,
  });
  await prisma.standardPrice.create({ data: { productId: product.id, price: "15.00" } });
  return product;
}

function sessionFor(userId: string) {
  return { user: { id: userId }, expires: new Date(Date.now() + 60_000).toISOString() };
}

function requestWithCookie(url: string, cookieValue?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (cookieValue) headers.set("cookie", `${CART_COOKIE_NAME}=${cookieValue}`);
  return new Request(url, { ...init, headers });
}

function cookieValueFrom(response: Response): string | undefined {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return undefined;
  const match = setCookie.match(new RegExp(`${CART_COOKIE_NAME}=([^;]+)`));
  return match?.[1];
}

beforeEach(() => {
  mockAuth.mockReset();
  mockAuth.mockResolvedValue(null);
});

afterEach(async () => {
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.standardPrice.deleteMany();
  await prisma.product.deleteMany({ where: { sku: { startsWith: "CART-ROUTE-SKU-" } } });
  await prisma.user.deleteMany({ where: { email: { contains: "cart-route-" } } });
});

describe("GET /api/cart", () => {
  it("returns an empty cart and sets a guest cookie for a first-time visitor", async () => {
    const response = await getCartRoute(new Request("http://localhost/api/cart"));
    const body = (await response.json()) as { items: unknown[] };

    expect(response.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(cookieValueFrom(response)).toBeDefined();
  });

  it("reuses the same guest cart across requests with the cookie", async () => {
    const first = await getCartRoute(new Request("http://localhost/api/cart"));
    const cookieValue = cookieValueFrom(first)!;

    const product = await makeProduct();
    await postCartItem(requestWithCookie("http://localhost/api/cart/items", cookieValue, { method: "POST", body: JSON.stringify({ productId: product.id, quantity: 1 }), headers: { "Content-Type": "application/json" } }));

    const second = await getCartRoute(requestWithCookie("http://localhost/api/cart", cookieValue));
    const body = (await second.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });
});

describe("POST /api/cart/items", () => {
  it("adds an item as a guest", async () => {
    const product = await makeProduct();
    const response = await postCartItem(
      new Request("http://localhost/api/cart/items", {
        method: "POST",
        body: JSON.stringify({ productId: product.id, quantity: 2 }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(response.status).toBe(200);
    expect(cookieValueFrom(response)).toBeDefined();
  });

  it("returns 409 with availableQuantity when the quantity exceeds stock", async () => {
    const product = await makeProduct({ stockQuantity: 2 });
    const response = await postCartItem(
      new Request("http://localhost/api/cart/items", {
        method: "POST",
        body: JSON.stringify({ productId: product.id, quantity: 5 }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    const body = (await response.json()) as { availableQuantity: number };
    expect(response.status).toBe(409);
    expect(body.availableQuantity).toBe(2);
  });

  it("returns 400 for an invalid body", async () => {
    const response = await postCartItem(
      new Request("http://localhost/api/cart/items", { method: "POST", body: JSON.stringify({ quantity: -1 }), headers: { "Content-Type": "application/json" } }),
    );
    expect(response.status).toBe(400);
  });

  it("adds to the authenticated user's cart when a session exists", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    await postCartItem(
      new Request("http://localhost/api/cart/items", { method: "POST", body: JSON.stringify({ productId: product.id, quantity: 1 }), headers: { "Content-Type": "application/json" } }),
    );

    const response = await getCartRoute(new Request("http://localhost/api/cart"));
    const body = (await response.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });
});

describe("PATCH /api/cart/items/[id]", () => {
  it("updates quantity for the owning guest cart", async () => {
    const product = await makeProduct();
    const addResponse = await postCartItem(
      new Request("http://localhost/api/cart/items", { method: "POST", body: JSON.stringify({ productId: product.id, quantity: 1 }), headers: { "Content-Type": "application/json" } }),
    );
    const cookieValue = cookieValueFrom(addResponse)!;
    const cartResponse = await getCartRoute(requestWithCookie("http://localhost/api/cart", cookieValue));
    const { items } = (await cartResponse.json()) as { items: { id: string }[] };

    const response = await patchCartItem(
      requestWithCookie(`http://localhost/api/cart/items/${items[0]!.id}`, cookieValue, { method: "PATCH", body: JSON.stringify({ quantity: 3 }), headers: { "Content-Type": "application/json" } }),
      { params: Promise.resolve({ id: items[0]!.id }) },
    );
    expect(response.status).toBe(200);
  });

  it("returns 403 when the item belongs to a different guest cart", async () => {
    const product = await makeProduct();
    const addResponse = await postCartItem(
      new Request("http://localhost/api/cart/items", { method: "POST", body: JSON.stringify({ productId: product.id, quantity: 1 }), headers: { "Content-Type": "application/json" } }),
    );
    const ownerCookie = cookieValueFrom(addResponse)!;
    const ownerCart = await getCartRoute(requestWithCookie("http://localhost/api/cart", ownerCookie));
    const { items } = (await ownerCart.json()) as { items: { id: string }[] };

    // A different guest (no cookie) tries to patch the first guest's item.
    const response = await patchCartItem(
      new Request(`http://localhost/api/cart/items/${items[0]!.id}`, { method: "PATCH", body: JSON.stringify({ quantity: 3 }), headers: { "Content-Type": "application/json" } }),
      { params: Promise.resolve({ id: items[0]!.id }) },
    );
    expect(response.status).toBe(403);
  });
});

describe("DELETE /api/cart/items/[id]", () => {
  it("removes the item for the owning cart", async () => {
    const product = await makeProduct();
    const addResponse = await postCartItem(
      new Request("http://localhost/api/cart/items", { method: "POST", body: JSON.stringify({ productId: product.id, quantity: 1 }), headers: { "Content-Type": "application/json" } }),
    );
    const cookieValue = cookieValueFrom(addResponse)!;
    const cartResponse = await getCartRoute(requestWithCookie("http://localhost/api/cart", cookieValue));
    const { items } = (await cartResponse.json()) as { items: { id: string }[] };

    const response = await deleteCartItem(requestWithCookie(`http://localhost/api/cart/items/${items[0]!.id}`, cookieValue, { method: "DELETE" }), {
      params: Promise.resolve({ id: items[0]!.id }),
    });
    expect(response.status).toBe(204);
  });

  it("returns 404 for a nonexistent item id", async () => {
    const response = await deleteCartItem(new Request("http://localhost/api/cart/items/does-not-exist", { method: "DELETE" }), {
      params: Promise.resolve({ id: "does-not-exist" }),
    });
    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run cart-routes`
Expected: FAIL — `Cannot find module '@/app/api/cart/route'`.

- [ ] **Step 5: Write `src/app/api/cart/route.ts`**

```typescript
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { readCartCookie, setCartCookie } from "@/lib/api/cart-cookie";
import { cartErrorResponse } from "@/lib/api/cart-responses";
import { getCart, resolveCartIdentity } from "@/services/cart.service";

export async function GET(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const guestCookieValue = readCartCookie(request);

    // Resolving identity separately from getCart (which also resolves it
    // internally) is intentional here — this is the one route that must
    // set the guest cookie on a first visit, so it needs the
    // newCookieValue that getCart's own return type doesn't carry.
    const { newCookieValue } = await resolveCartIdentity(userId, guestCookieValue);
    const summary = await getCart(userId, guestCookieValue);

    const response = NextResponse.json(summary);
    if (newCookieValue) setCartCookie(response, newCookieValue);
    return response;
  } catch (error) {
    return cartErrorResponse(error);
  }
}
```

- [ ] **Step 6: Write `src/app/api/cart/items/route.ts`**

```typescript
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { cartErrorResponse } from "@/lib/api/cart-responses";
import { validationErrorResponse } from "@/lib/api/responses";
import { readCartCookie, setCartCookie } from "@/lib/api/cart-cookie";
import { addItem } from "@/services/cart.service";
import { addCartItemSchema } from "@/validation/cart.schema";

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = addCartItemSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const guestCookieValue = readCartCookie(request);

    const { newCookieValue } = await addItem(userId, guestCookieValue, parsed.data.productId, parsed.data.quantity);

    const response = NextResponse.json({ ok: true });
    if (newCookieValue) setCartCookie(response, newCookieValue);
    return response;
  } catch (error) {
    return cartErrorResponse(error);
  }
}
```

- [ ] **Step 7: Write `src/app/api/cart/items/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { cartErrorResponse } from "@/lib/api/cart-responses";
import { validationErrorResponse } from "@/lib/api/responses";
import { readCartCookie } from "@/lib/api/cart-cookie";
import { removeItem, updateItemQuantity } from "@/services/cart.service";
import { updateCartItemSchema } from "@/validation/cart.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body: unknown = await request.json();
  const parsed = updateCartItemSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const guestCookieValue = readCartCookie(request);

    await updateItemQuantity(userId, guestCookieValue, id, parsed.data.quantity);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return cartErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const guestCookieValue = readCartCookie(request);

    await removeItem(userId, guestCookieValue, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return cartErrorResponse(error);
  }
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run cart-routes`
Expected: PASS (all tests). Ensure `npx prisma dev` is running first.

- [ ] **Step 9: `tsc`/lint**

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint
```

- [ ] **Step 10: Commit**

```bash
git add src/lib/api/cart-responses.ts src/lib/api/cart-cookie.ts "src/app/api/cart" tests/unit/cart-routes.test.ts
git commit -m "feat: add cart API routes (get, add, update, remove)"
```

---

## Task 8: `POST /api/cart/merge` route

**Files:**
- Create: `src/app/api/cart/merge/route.ts`
- Test: `tests/unit/cart-routes.test.ts` (append)

**Interfaces:**
- Consumes: `mergeGuestCartIntoUser` (Task 6); `readCartCookie` (from `@/lib/api/cart-cookie`, Task 7).
- Produces: `POST /api/cart/merge`. Task 9's `CartMergeSync` calls this by URL.

- [ ] **Step 1: Append the failing test to `tests/unit/cart-routes.test.ts`**

```typescript
describe("POST /api/cart/merge", () => {
  it("requires authentication", async () => {
    const response = await postCartMerge(new Request("http://localhost/api/cart/merge", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("merges the guest cart identified by the request's cookie into the authenticated user's cart", async () => {
    const product = await makeProduct();
    const addResponse = await postCartItem(
      new Request("http://localhost/api/cart/items", { method: "POST", body: JSON.stringify({ productId: product.id, quantity: 2 }), headers: { "Content-Type": "application/json" } }),
    );
    const guestCookie = cookieValueFrom(addResponse)!;

    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await postCartMerge(requestWithCookie("http://localhost/api/cart/merge", guestCookie, { method: "POST" }));
    expect(response.status).toBe(200);

    const cartResponse = await getCartRoute(new Request("http://localhost/api/cart"));
    const body = (await cartResponse.json()) as { items: { quantity: number }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.quantity).toBe(2);
  });
});
```

Add `POST as postCartMerge` to the existing `@/app/api/cart/merge/route` import (new import line).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run cart-routes`
Expected: FAIL — `Cannot find module '@/app/api/cart/merge/route'` (the 2 new tests fail; all prior tests still pass).

- [ ] **Step 3: Write `src/app/api/cart/merge/route.ts`**

```typescript
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api/responses";
import { cartErrorResponse } from "@/lib/api/cart-responses";
import { readCartCookie } from "@/lib/api/cart-cookie";
import { mergeGuestCartIntoUser } from "@/services/cart.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const guestCookieValue = readCartCookie(request);
    await mergeGuestCartIntoUser(session.user.id, guestCookieValue);

    // The guest cookie is cleared client-side only after this response
    // succeeds (CartMergeSync, Task 9) — but clearing it here too means a
    // stale cookie from a different tab can't resurrect a Cart row this
    // request already deleted.
    const response = NextResponse.json({ ok: true });
    response.cookies.delete("oristor-cart-token");
    return response;
  } catch (error) {
    return cartErrorResponse(error);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run cart-routes`
Expected: PASS (all tests, prior + new).

- [ ] **Step 5: `tsc`/lint**

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/cart/merge" tests/unit/cart-routes.test.ts
git commit -m "feat: add cart merge API route"
```

---

## Task 9: Frontend state layer — `useCart`, `useAddToCart`, `CartMergeSync`, retiring `cart-store.ts`

**Files:**
- Create: `src/hooks/use-cart.ts`
- Modify: `src/hooks/use-add-to-cart.ts`
- Modify: `src/components/storefront/layout/cart-badge.tsx`
- Delete: `src/lib/stores/cart-store.ts`
- Create: `src/components/providers/cart-merge-sync.tsx`
- Modify: `src/app/providers.tsx`
- Test: `tests/unit/use-cart.test.tsx`
- Test: `tests/unit/cart-badge.test.tsx`

**Interfaces:**
- Consumes: `CartSummary`/`CartLineItem` (Task 3); the API routes (Tasks 7–8, called via `fetch`).
- Produces: `useCart(): { cart: CartSummary | undefined; isPending: boolean; addItem: (productId: string, quantity?: number) => void; updateQuantity: (itemId: string, quantity: number) => void; removeItem: (itemId: string) => void }`; `useAddToCart(productId: string): UseAddToCartResult` (real implementation, same shape as the existing stub). Task 10's `CartDrawer`/cart page consume `useCart`.

- [ ] **Step 1: Write `tests/unit/use-cart.test.tsx`**

```tsx
// tests/unit/use-cart.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCart } from "@/hooks/use-cart";
import type { CartSummary } from "@/types/cart";

const emptyCart: CartSummary = { items: [], itemCount: 0, subtotal: 0, currency: "LKR", rewardPointsEarned: 0 };

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(emptyCart), { status: 200, headers: { "Content-Type": "application/json" } })),
  );
});

describe("useCart", () => {
  it("fetches the current cart from GET /api/cart", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await waitFor(() => expect(result.current.cart).toBeDefined());
    expect(result.current.cart).toEqual(emptyCart);
    expect(fetch).toHaveBeenCalledWith("/api/cart", expect.anything());
  });

  it("addItem POSTs to /api/cart/items and invalidates the cart query", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.cart).toBeDefined());

    result.current.addItem("product-1", 2);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/cart/items",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ productId: "product-1", quantity: 2 }) }),
      );
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run use-cart`
Expected: FAIL — `Cannot find module '@/hooks/use-cart'`.

- [ ] **Step 3: Write `src/hooks/use-cart.ts`**

```typescript
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CartSummary } from "@/types/cart";

async function fetchCart(): Promise<CartSummary> {
  const response = await fetch("/api/cart", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to load cart");
  return response.json() as Promise<CartSummary>;
}

export function useCart() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["cart"], queryFn: fetchCart });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["cart"] });

  const addItemMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity }),
      });
      if (!response.ok) throw new Error("Failed to add to cart");
    },
    onSuccess: invalidate,
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      if (!response.ok) throw new Error("Failed to update quantity");
    },
    onSuccess: invalidate,
  });

  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await fetch(`/api/cart/items/${itemId}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error("Failed to remove item");
    },
    onSuccess: invalidate,
  });

  return {
    cart: query.data,
    isPending: query.isPending,
    addItem: (productId: string, quantity = 1) => addItemMutation.mutate({ productId, quantity }),
    updateQuantity: (itemId: string, quantity: number) => updateQuantityMutation.mutate({ itemId, quantity }),
    removeItem: (itemId: string) => removeItemMutation.mutate(itemId),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run use-cart`
Expected: PASS (2 tests).

- [ ] **Step 5: Replace the `useAddToCart` stub**

```typescript
// src/hooks/use-add-to-cart.ts
"use client";

import { useCart } from "@/hooks/use-cart";

export interface UseAddToCartResult {
  isAvailable: boolean;
  addToCart: (quantity?: number) => void;
}

export function useAddToCart(productId: string): UseAddToCartResult {
  const { addItem } = useCart();
  return {
    isAvailable: true,
    addToCart: (quantity = 1) => addItem(productId, quantity),
  };
}
```

- [ ] **Step 6: Delete `src/lib/stores/cart-store.ts` and update `CartBadge`**

```bash
rm src/lib/stores/cart-store.ts
```

```tsx
// src/components/storefront/layout/cart-badge.tsx
"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useCart } from "@/hooks/use-cart";

export function CartBadge() {
  const { cart } = useCart();
  const count = cart?.itemCount ?? 0;

  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"}
      className="relative inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <ShoppingCart className="size-5" aria-hidden="true" />
      {count > 0 && (
        <Badge className="absolute top-0.5 right-0.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none">
          {count > 99 ? "99+" : count}
        </Badge>
      )}
    </Link>
  );
}
```

- [ ] **Step 7: Write `tests/unit/cart-badge.test.tsx`**

```tsx
// tests/unit/cart-badge.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CartBadge } from "@/components/storefront/layout/cart-badge";
import type { CartSummary } from "@/types/cart";

function renderWithCart(cart: CartSummary) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(cart), { status: 200, headers: { "Content-Type": "application/json" } })));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CartBadge />
    </QueryClientProvider>,
  );
}

describe("CartBadge", () => {
  it("shows no badge for an empty cart", async () => {
    renderWithCart({ items: [], itemCount: 0, subtotal: 0, currency: "LKR", rewardPointsEarned: 0 });
    expect(await screen.findByRole("link", { name: "Cart" })).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows the item count once the cart loads", async () => {
    renderWithCart({ items: [], itemCount: 3, subtotal: 100, currency: "LKR", rewardPointsEarned: 5 });
    expect(await screen.findByText("3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cart, 3 items" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run cart-badge`
Expected: PASS (2 tests).

- [ ] **Step 9: Write `src/components/providers/cart-merge-sync.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

/**
 * Watches for the unauthenticated -> authenticated session transition and
 * merges the guest cart (identified server-side by the still-present
 * guest cookie) into the user's account cart exactly once per transition.
 * Mirrors WishlistMergeSync's mechanism exactly — no login page/event
 * exists yet in this codebase, so this reacts to session state rather
 * than a login submit handler. Unlike WishlistMergeSync, there's no
 * client-side guest state to read first: the merge endpoint resolves the
 * guest cart itself from the request's own cookie.
 */
export function CartMergeSync() {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const prevStatus = useRef(status);

  useEffect(() => {
    const justAuthenticated = prevStatus.current !== "authenticated" && status === "authenticated";
    prevStatus.current = status;
    if (!justAuthenticated) return;

    fetch("/api/cart/merge", { method: "POST", credentials: "include" })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["cart"] });
      })
      .catch(() => {
        // Merge failure leaves the guest cookie/cart intact server-side,
        // so it's retried on the next authenticated transition.
      });
  }, [status, queryClient]);

  return null;
}
```

- [ ] **Step 10: Mount it in `src/app/providers.tsx`**

```typescript
import { CartMergeSync } from "@/components/providers/cart-merge-sync";
```

```tsx
        <WishlistMergeSync />
        <RecipeBookmarkMergeSync />
        <CartMergeSync />
```

- [ ] **Step 11: `tsc`/lint**

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint
```

Expected: no errors, and confirm no remaining import of `useCartStore`/`cart-store` anywhere (`grep -rln "cart-store\|useCartStore" src/` should return nothing).

- [ ] **Step 12: Commit**

```bash
git add src/hooks/use-cart.ts src/hooks/use-add-to-cart.ts src/components/storefront/layout/cart-badge.tsx src/components/providers/cart-merge-sync.tsx src/app/providers.tsx tests/unit/use-cart.test.tsx tests/unit/cart-badge.test.tsx
git rm src/lib/stores/cart-store.ts
git commit -m "feat: add useCart/useAddToCart, CartMergeSync, retire cart-store.ts"
```

---

## Task 10: `CartDrawer`, the full cart page, and supporting components

**Files:**
- Create: `src/components/storefront/cart/cart-line-item.tsx`
- Create: `src/components/storefront/cart/empty-cart.tsx`
- Create: `src/components/storefront/cart/cart-drawer.tsx`
- Create: `src/app/(storefront)/cart/page.tsx`
- Test: `tests/unit/cart-line-item.test.tsx`
- Test: `tests/unit/empty-cart.test.tsx`

**Interfaces:**
- Consumes: `useCart` (Task 9); `CartLineItem`/`CartSummary` (Task 3).
- Produces: the `/cart` page and the mini-cart drawer. No later task depends on these directly.

- [ ] **Step 1: Write `tests/unit/cart-line-item.test.tsx`**

```tsx
// tests/unit/cart-line-item.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CartLineItemRow } from "@/components/storefront/cart/cart-line-item";
import type { CartLineItem } from "@/types/cart";

const baseItem: CartLineItem = {
  id: "item-1",
  productId: "product-1",
  productName: "Roasted Curry Powder 100g",
  productSlug: "roasted-curry-powder-100g",
  imageSrc: "/images/products/export/curry-powder.webp",
  imageAlt: "Roasted Curry Powder",
  quantity: 2,
  unitPrice: 25,
  currency: "LKR",
  lineTotal: 50,
  rewardPointsEarned: 10,
  priceChanged: false,
  unavailable: false,
  quantityCapped: false,
  availableQuantity: 100,
};

describe("CartLineItemRow", () => {
  it("renders the product name, quantity, and line total", () => {
    render(<CartLineItemRow item={baseItem} onQuantityChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText("Roasted Curry Powder 100g")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("calls onQuantityChange with the incremented value", async () => {
    const user = userEvent.setup();
    const onQuantityChange = vi.fn();
    render(<CartLineItemRow item={baseItem} onQuantityChange={onQuantityChange} onRemove={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /increase quantity/i }));
    expect(onQuantityChange).toHaveBeenCalledWith(3);
  });

  it("calls onRemove when the remove button is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<CartLineItemRow item={baseItem} onQuantityChange={vi.fn()} onRemove={onRemove} />);

    await user.click(screen.getByRole("button", { name: /remove/i }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("shows a price-changed notice when priceChanged is true", () => {
    render(<CartLineItemRow item={{ ...baseItem, priceChanged: true }} onQuantityChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText(/price.*changed/i)).toBeInTheDocument();
  });

  it("shows an unavailable notice when unavailable is true", () => {
    render(<CartLineItemRow item={{ ...baseItem, unavailable: true }} onQuantityChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText(/no longer available/i)).toBeInTheDocument();
  });

  it("shows a stock-capped notice and disables increasing past availableQuantity when quantityCapped is true", () => {
    render(<CartLineItemRow item={{ ...baseItem, quantityCapped: true, availableQuantity: 2, quantity: 5 }} onQuantityChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText(/only 2 left/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run cart-line-item`
Expected: FAIL — `Cannot find module '@/components/storefront/cart/cart-line-item'`.

- [ ] **Step 3: Write `src/components/storefront/cart/cart-line-item.tsx`**

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CartLineItem } from "@/types/cart";

interface CartLineItemRowProps {
  item: CartLineItem;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

export function CartLineItemRow({ item, onQuantityChange, onRemove }: CartLineItemRowProps) {
  const noticeId = `cart-item-notice-${item.id}`;
  const hasNotice = item.priceChanged || item.unavailable || item.quantityCapped;

  return (
    <div className="flex gap-4 border-b border-input py-4" aria-describedby={hasNotice ? noticeId : undefined}>
      <div className="relative size-20 shrink-0">
        <Image src={item.imageSrc} alt={item.imageAlt} fill sizes="80px" className="rounded-lg object-cover" />
      </div>
      <div className="flex-1">
        <Link href={`/products/${item.productSlug}`} className="text-body font-medium text-charcoal hover:underline">
          {item.productName}
        </Link>
        <p className="mt-1 text-small text-charcoal/70">
          {item.currency} {item.unitPrice.toFixed(2)} each
        </p>

        <div className="mt-2 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Decrease quantity of ${item.productName}`}
            disabled={item.quantity <= 1}
            onClick={() => onQuantityChange(item.quantity - 1)}
          >
            <Minus />
          </Button>
          <span className="w-6 text-center font-number" aria-live="polite">
            {item.quantity}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Increase quantity of ${item.productName}`}
            disabled={item.quantity >= item.availableQuantity}
            onClick={() => onQuantityChange(item.quantity + 1)}
          >
            <Plus />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${item.productName} from cart`} onClick={onRemove}>
            <X />
          </Button>
        </div>

        {hasNotice && (
          <p id={noticeId} role="status" className="mt-2 text-small text-destructive">
            {item.unavailable && "This item is no longer available."}
            {!item.unavailable && item.quantityCapped && `Only ${item.availableQuantity} left in stock.`}
            {!item.unavailable && !item.quantityCapped && item.priceChanged && "The price for this item just changed."}
          </p>
        )}
      </div>
      <p className="font-number text-body text-charcoal">
        {item.currency} {item.lineTotal.toFixed(2)}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run cart-line-item`
Expected: PASS (6 tests).

- [ ] **Step 5: Write `tests/unit/empty-cart.test.tsx`**

```tsx
// tests/unit/empty-cart.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyCart } from "@/components/storefront/cart/empty-cart";

describe("EmptyCart", () => {
  it("shows an empty-cart message with a link back to Products", () => {
    render(<EmptyCart />);
    expect(screen.getByText(/cart is empty/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /shop products/i })).toHaveAttribute("href", "/products");
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run empty-cart`
Expected: FAIL — `Cannot find module '@/components/storefront/cart/empty-cart'`.

- [ ] **Step 7: Write `src/components/storefront/cart/empty-cart.tsx`**

```tsx
import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";

export function EmptyCart() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <ShoppingCart className="size-12 text-charcoal/40" aria-hidden="true" />
      <p className="text-h4 font-heading text-charcoal">Your cart is empty</p>
      <p className="text-small text-charcoal/70">Looks like you haven&apos;t added anything yet.</p>
      <Button asChild>
        <Link href="/products">Shop Products</Link>
      </Button>
    </div>
  );
}
```

Note: `<Button asChild>` follows the same pattern this codebase's `Button` doesn't actually support (confirmed during STORY-023 — it uses Base UI's `render` prop, and `render` alone still stamps `role="button"` onto an anchor). Write this instead:

```tsx
import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export function EmptyCart() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <ShoppingCart className="size-12 text-charcoal/40" aria-hidden="true" />
      <p className="text-h4 font-heading text-charcoal">Your cart is empty</p>
      <p className="text-small text-charcoal/70">Looks like you haven&apos;t added anything yet.</p>
      <Link href="/products" className={buttonVariants({ variant: "default" })}>
        Shop Products
      </Link>
    </div>
  );
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run empty-cart`
Expected: PASS (1 test).

- [ ] **Step 9: Write `src/components/storefront/cart/cart-drawer.tsx`**

```tsx
"use client";

import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { CartLineItemRow } from "@/components/storefront/cart/cart-line-item";
import { EmptyCart } from "@/components/storefront/cart/empty-cart";
import { useCart } from "@/hooks/use-cart";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const { cart, updateQuantity, removeItem } = useCart();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <div className="flex h-full w-full max-w-md flex-col bg-cream p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-h4 font-heading text-charcoal">Your Cart</h2>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close cart" onClick={onClose}>
            ×
          </Button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto">
          {!cart || cart.items.length === 0 ? (
            <EmptyCart />
          ) : (
            cart.items.map((item) => (
              <CartLineItemRow
                key={item.id}
                item={item}
                onQuantityChange={(quantity) => updateQuantity(item.id, quantity)}
                onRemove={() => removeItem(item.id)}
              />
            ))
          )}
        </div>

        {cart && cart.items.length > 0 && (
          <div className="mt-4 border-t border-input pt-4">
            <div className="flex items-center justify-between text-body font-medium text-charcoal">
              <span>Subtotal</span>
              <span>
                {cart.currency} {cart.subtotal.toFixed(2)}
              </span>
            </div>
            <Link href="/cart" className={buttonVariants({ variant: "default", className: "mt-4 w-full justify-center" })} onClick={onClose}>
              View Cart
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Write `src/app/(storefront)/cart/page.tsx`**

```tsx
"use client";

import type { Metadata } from "next";

import { Section } from "@/components/storefront/layout/section";
import { CartLineItemRow } from "@/components/storefront/cart/cart-line-item";
import { EmptyCart } from "@/components/storefront/cart/empty-cart";
import { buttonVariants } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";

export default function CartPage() {
  const { cart, isPending, updateQuantity, removeItem } = useCart();

  return (
    <Section>
      <h1 className="text-h1 font-heading text-charcoal">Your Cart</h1>

      {isPending ? (
        <p className="mt-8 text-body text-charcoal/70">Loading your cart…</p>
      ) : !cart || cart.items.length === 0 ? (
        <EmptyCart />
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {cart.items.map((item) => (
              <CartLineItemRow
                key={item.id}
                item={item}
                onQuantityChange={(quantity) => updateQuantity(item.id, quantity)}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </div>
          <div className="rounded-lg border border-input p-6">
            <h2 className="text-h4 font-heading text-charcoal">Order Summary</h2>
            <div className="mt-4 flex items-center justify-between text-body text-charcoal">
              <span>Subtotal</span>
              <span className="font-number">
                {cart.currency} {cart.subtotal.toFixed(2)}
              </span>
            </div>
            <p className="mt-2 text-small text-charcoal/70">
              You&apos;ll earn <span className="font-number">{cart.rewardPointsEarned}</span> reward points with this purchase.
            </p>
            <button
              type="button"
              disabled
              aria-disabled="true"
              title="Checkout isn't available yet"
              className={buttonVariants({ variant: "default", className: "mt-6 w-full justify-center opacity-50" })}
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}
```

Note: this page is a Client Component (`"use client"`, since `useCart` is a client hook with no server-fetched initial data) — the `export const metadata` pattern every other storefront page uses doesn't apply to a Client Component page. If a static `<title>` is wanted, add a `generateMetadata`-free static export is not possible here; skip page-level metadata for this story (the cart page is not indexed/shared content) rather than restructuring around a Server Component wrapper — that restructuring is not required by any AC.

- [ ] **Step 11: `tsc`/lint**

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint
```

- [ ] **Step 12: Commit**

```bash
git add src/components/storefront/cart "src/app/(storefront)/cart" tests/unit/cart-line-item.test.tsx tests/unit/empty-cart.test.tsx
git commit -m "feat: add cart drawer, full cart page, and line-item/empty-state components"
```

---

## Task 11: Playwright e2e tests

**Files:**
- Create: `tests/e2e/cart.spec.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db` (seeding fixtures directly, matching every other e2e spec's convention); `createProduct` from `@/repositories/product.repository` (existing).
- Produces: nothing consumed by later tasks — this is the final functional task before documentation.

- [ ] **Step 1: Write `tests/e2e/cart.spec.ts`**

```typescript
import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";

import { signInAs } from "./helpers/auth";

const SKU_PREFIX = "E2E-CART-";
const EMAIL_DOMAIN = "@e2e-cart.test";

async function seedProduct(n: number, name: string, stockQuantity: number) {
  const product = await createProduct({
    sku: `${SKU_PREFIX}${n}`,
    slug: `e2e-cart-product-${n}`,
    name,
    status: "Published",
    stockQuantity,
  });
  await prisma.standardPrice.create({ data: { productId: product.id, price: "30.00" } });
  return product;
}

test.describe("Shopping cart", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.standardPrice.deleteMany({ where: { product: { sku: { startsWith: SKU_PREFIX } } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  });

  test("adding an item as a guest persists across reload, then merges into the account on sign-in", async ({ page }) => {
    const product = await seedProduct(1, "E2E Cart Curry Powder", 20);
    const user = await prisma.user.create({ data: { email: `merge${EMAIL_DOMAIN}`, name: "Merge Tester" } });

    const addResponse = await page.request.post("/api/cart/items", { data: { productId: product.id, quantity: 2 } });
    expect(addResponse.status()).toBe(200);

    await page.goto("/cart");
    await expect(page.getByText("E2E Cart Curry Powder")).toBeVisible();

    await page.reload();
    await expect(page.getByText("E2E Cart Curry Powder")).toBeVisible();

    await signInAs(page, user.id);
    await page.request.post("/api/cart/merge");
    await page.reload();

    await expect(page.getByText("E2E Cart Curry Powder")).toBeVisible();
  });

  test("adding a quantity beyond stock is blocked with a clear message", async ({ page }) => {
    const product = await seedProduct(2, "E2E Cart Limited Stock Item", 2);

    const response = await page.request.post("/api/cart/items", { data: { productId: product.id, quantity: 5 } });
    expect(response.status()).toBe(409);
    const body = (await response.json()) as { error: string; availableQuantity: number };
    expect(body.availableQuantity).toBe(2);
  });

  test("the cart page has no detectable accessibility violations", async ({ page }) => {
    const product = await seedProduct(3, "E2E Cart A11y Item", 10);
    await page.request.post("/api/cart/items", { data: { productId: product.id, quantity: 1 } });

    await page.goto("/cart");
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the e2e suite**

```bash
npx playwright test tests/e2e/cart.spec.ts --workers=1
```
Expected: PASS (all tests). Ensure `npx prisma dev` is running and the DB is seeded first.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/cart.spec.ts
git commit -m "test: add shopping cart e2e coverage"
```

---

## Task 12: Documentation

**Files:**
- Modify: `docs/architecture-decisions.md`

**Interfaces:**
- Consumes: nothing (documentation only).
- Produces: nothing consumed by later tasks — this is the plan's final task.

- [ ] **Step 1: Append a new dated entry to `docs/architecture-decisions.md`**

```markdown
---

## 2026-09-27 — STORY-024 Shopping Cart

**The guest-cart cookie (`oristor-cart-token`) is the first hand-set,
non-NextAuth cookie in this codebase.** It's a 24-byte random token,
HMAC-SHA256-signed with the existing `AUTH_SECRET` (no new secret
provisioned), stored as `token.signature` in an `httpOnly`,
`sameSite: lax`, 30-day cookie. `src/lib/cart-token.ts`'s
`verifyCartCookieValue()` is the only place that trusts a cookie value as
a `Cart.guestToken` lookup key — it constant-time-compares the signature
and returns `null` (never throws) for anything missing, malformed, or
tampered, which `cart.service.ts`'s `resolveCartIdentity()` treats
identically to "no guest cart yet" (creates a fresh one). Any future
story needing a signed, server-verified guest identity (not just
client-side `localStorage`, which Wishlist/Recipe Bookmark already cover)
should reuse this exact shape rather than inventing a second signing
scheme.

**Cart merge is server-to-server, not a client-payload POST — deliberately
different from `mergeGuestWishlist`.** Wishlist's guest state is 100%
`localStorage`, so its merge endpoint receives a product-id array in the
request body. The cart's guest state is *also* server-persisted (a real
`Cart` row keyed by the guest cookie, needed so price/stock can be
revalidated even before login) — so `POST /api/cart/merge` takes no body
at all; it resolves the guest `Cart` from the request's own cookie,
combines matching-product quantities into the user's cart (capped at
current `Product.stockQuantity`), appends distinct products, then deletes
the guest `Cart` row and clears the cookie. `CartMergeSync`
(`src/components/providers/cart-merge-sync.tsx`) mirrors
`WishlistMergeSync`'s session-transition-watcher trigger exactly, just
without any client state to read first.

**`Product.stockQuantity` was added directly to `Product`, scoped
narrowly on purpose — no `Reservation`/`StockHold` model, no background
cleanup job.** STORY-009 never built real inventory tracking (`Product`
only had a boolean `inStock`), but this story's AC requires blocking a
cart quantity that exceeds available stock, which a boolean can't express.
The cart checks the requested quantity against the live `stockQuantity`
on every add/update and again on every read — it does not reserve stock
ahead of checkout (STORY-025's territory once it exists) and does not run
any scheduled abandoned-cart cleanup (the guest cookie's own 30-day
expiry is the only cleanup mechanism this story ships).

**Every price resolution call uses `customerGroup: "Retail"` — a
codebase-wide limitation, not a cart-specific one.** `User` has no
`customerGroup` field (deferred to STORY-033/034's customer profile or
STORY-038's admin roles). `wishlist.service.ts`, `product.service.ts`,
`search.service.ts`, and now `cart.service.ts` all hardcode `"Retail"` for
the same reason — the pricing engine's other four tiers
(campaign/sale/customerGroup/volumeDiscount) already work correctly for
every product, and wiring a real customer group through will only ever
require changing the value passed at each of these call sites, never the
engine itself.

**`resolvePrice()` is called per cart line, never the bulk
`resolvePricesForProducts()`.** The bulk function shares one `quantity`
across every requested product (correct for a listing page, where every
product is implicitly priced at quantity=1) — a cart has a different
quantity per line, and `VolumeDiscountTier` selection depends on it. Carts
are small (a handful of lines), so N individual 5-query `resolvePrice()`
calls is the right tradeoff; the bulk function's reason to exist
(avoiding N-per-product fetches at listing scale) doesn't apply here.

**Revalidation always refreshes to the live price, and flags the change
exactly once — not a standing "outdated" banner.** On every cart read,
each line's live price is compared to its stored `unitPriceSnapshot`; if
they differ, the response marks that line `priceChanged: true` for this
read only, then the snapshot is overwritten to the live price before the
response is built. The displayed total is always current; the notice
tells the customer something moved, without becoming stale information
itself on the next read. Availability (`unavailable`,
`quantityCapped`) works the same way and never silently mutates or
removes a line — the customer adjusts or removes it themselves.
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture-decisions.md
git commit -m "docs: document the guest-cart cookie, merge algorithm, and stock/pricing decisions for STORY-024"
```

---

## Final Verification

After all 12 tasks are complete:

- [ ] `npx tsc --noEmit -p tsconfig.json` — no errors.
- [ ] `npm run lint` — no errors.
- [ ] `npm run test` (with `npx prisma dev` running, freshly restarted) — full suite passes, including every file this plan added.
- [ ] `npm run test:e2e` — full suite passes, including `cart.spec.ts`.
- [ ] `npm run build` — production build compiles clean.
- [ ] Manually re-verify in the browser: add a product to the cart from a PDP while signed out, confirm the cart badge count updates and the item survives a reload; open `/cart`, adjust quantity, remove an item, confirm the empty-cart state renders; sign in and confirm the guest cart merged into the account.
- [ ] Re-read the design spec (`docs/superpowers/specs/2026-09-27-shopping-cart-design.md`) once more against the finished code — confirm every numbered decision (1 through 13) has a corresponding implementation.
