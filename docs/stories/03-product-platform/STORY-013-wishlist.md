# STORY-013: Wishlist

**Status:** Draft
**Epic:** 03 — Product Platform
**Priority:** Medium
**Persona(s):** Home Cook, Sri Lankan Expat, Busy Professional

## User Story
As a Home Cook, I want to save products I'm interested in to a wishlist, so that I can come back and buy them later without having to search again.

As a Sri Lankan Expat, I want my wishlist to be saved on my account and available across devices once I log in, so that I don't lose my list when I switch from my phone to my laptop.

As a Busy Professional, I want to move an entire wishlist to my cart in one action, so that I can check out quickly when I'm ready to buy.

## Description
This story implements the Wishlist feature listed in `docs/blueprint.md` Section 4's top-level site structure and referenced as part of the Product Detail Page's required "add to wishlist" interaction (Section 4) and Section 9 item 3's Product Platform scope. It covers both guest (unauthenticated, client-persisted) and logged-in (server-persisted) wishlist behavior, including merging a guest wishlist into the account wishlist on login, and moving items from the wishlist into the cart.

## Acceptance Criteria
- [ ] A heart/wishlist toggle is available on `ProductCard` (STORY-010) and the Product Detail Page (STORY-011), reflecting current wishlist membership
- [ ] Guest (unauthenticated) users can add/remove items to a client-persisted wishlist (e.g. `localStorage` via a Zustand store) without creating an account
- [ ] Logged-in users' wishlist items persist server-side via `Wishlist`/`WishlistItem` Prisma models, one wishlist per user, unique constraint on `(userId, productId)`
- [ ] On login, an existing guest wishlist is merged into the user's server-side wishlist (union of items, no duplicates), and the client-side copy is cleared afterward
- [ ] `/account/wishlist` (or `/wishlist`) lists all wishlist items with image, name, current resolved price (via `pricing.service.ts`), and availability
- [ ] Each wishlist item can be removed individually, or moved to cart individually
- [ ] A "move all to cart" action exists, skipping/flagging any out-of-stock items rather than failing the whole action
- [ ] An empty wishlist state is shown with a prompt to browse products
- [ ] Adding/removing an item shows a toast or inline confirmation
- [ ] A wishlist item count badge is available for the header navigation to consume (integration point for STORY-004's header, Epic 02)
- [ ] Wishlist item prices always reflect the current resolved price at view time, not a price locked in when the item was added
- [ ] Wishlist state and mutations are managed through TanStack Query (server state) for logged-in users and Zustand (client state) for guests, per the project's state-management convention

## Tasks

- [ ] **Database:**
  - [ ] Add `Wishlist` and `WishlistItem` Prisma models (`WishlistItem` unique on `userId`/`wishlistId` + `productId`) to `prisma/schema.prisma`
  - [ ] Run and verify the migration

- [ ] **API:**
  - [ ] `GET /api/wishlist` — list current user's wishlist
  - [ ] `POST /api/wishlist` — add a product
  - [ ] `DELETE /api/wishlist/[productId]` — remove a product
  - [ ] `POST /api/wishlist/merge` — merge a client-provided guest wishlist (array of product IDs) into the authenticated user's wishlist

- [ ] **Service/Backend:**
  - [ ] Implement `wishlist.service.ts` (add, remove, list, merge) calling a new `wishlist.repository.ts` — never Prisma directly from route handlers
  - [ ] Implement merge logic that de-duplicates and ignores products that no longer exist or are unpublished

- [ ] **Frontend:**
  - [ ] Build the guest wishlist Zustand store (persisted to `localStorage`)
  - [ ] Build the wishlist toggle component shared by `ProductCard` and the PDP
  - [ ] Build the `/account/wishlist` (or `/wishlist`) page: item list, remove, move-to-cart, move-all-to-cart, empty state
  - [ ] Wire the guest-to-account merge call into the login success flow
  - [ ] Expose a wishlist-count hook for the header badge (STORY-004 integration point)

- [ ] **Validation:**
  - [ ] Zod schemas for add/remove/merge request bodies (valid product ID(s), array size limits on merge)

- [ ] **Testing:**
  - [ ] Unit test the merge logic (dedup, unpublished/deleted product handling)
  - [ ] Playwright e2e test: guest adds items, logs in, confirms items persisted and merged into account wishlist
  - [ ] Playwright e2e test: move-to-cart and move-all-to-cart flows, including an out-of-stock item in the batch

- [ ] **Documentation:**
  - [ ] Document the guest-to-account merge contract and the header wishlist-count integration point for STORY-004

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation + Global Layout)
- STORY-009 (Product Catalogue Data Model) — product/pricing data displayed in the wishlist
- STORY-010 (Product Listing, Categories & Filters) — `ProductCard` hosts the wishlist toggle
- STORY-011 (Product Detail Page) — PDP hosts the wishlist toggle

## Out of Scope
- Shopping cart persistence and checkout (Epic 05) — this story only defines the "move to cart" call-out, not cart internals
- Wishlist sharing with other users (not specified in the blueprint)

## References
- `docs/blueprint.md` Section 4 (Site Structure — Wishlist)
- `docs/blueprint.md` Section 9 item 3 (Product Platform)
