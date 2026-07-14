# STORY-033: Customer Dashboard

**Status:** Draft
**Epic:** 06 — Customer Platform
**Priority:** High
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast, Distributor (all customer personas — this is the entry point to the whole Customer Platform epic)

## User Story
As a returning customer, I want to log in and land on an account dashboard that summarizes my recent orders, reward points, and saved items, so that I can quickly see the state of my account and jump to what I need.

As a new visitor, I want to register an account (or sign in if I already have one), so that I can access personalized account features, checkout faster, and start earning rewards.

As a logged-in customer, I want to log out and have my session fully cleared, so that my account stays secure on shared devices.

## Description
This story is the front door of the Customer Platform (`docs/blueprint.md` Section 9 item 6): the registration/login/logout flow via NextAuth, the auth-guarded `/account` route group, and the dashboard landing page itself. It corresponds to "Customer Portal" in Section 4 and "registration, login, profiles" in Section 5. The dashboard composes lightweight summary widgets — recent orders, reward points, saved items, quick links — that read from the services owned by other stories (Order Management, Rewards, Wishlist) rather than owning that data itself. Profile/address editing, the full reward/referral dashboards, order history, and saved recipes each get their own story (STORY-034 through STORY-037); this story only needs enough of each domain to render a summary card and a link.

## Acceptance Criteria
- [ ] Registration form (name, email, password, marketing opt-in checkbox) validates with Zod, creates a NextAuth-backed `User` record with a hashed password, and signs the customer in on success
- [ ] Login form authenticates via NextAuth credentials provider; invalid credentials show a single generic error (no "email not found" vs "wrong password" disclosure); repeated failed attempts are rate-limited
- [ ] Forgot-password flow: request form sends a reset link (email service may be stubbed per STORY-001's auth scaffold), reset-password form enforces the same password rules as registration, and old sessions are invalidated after a successful reset
- [ ] Unauthenticated requests to any `/account/*` route redirect to `/account/login?callbackUrl=...` and land back on the originally requested page after login
- [ ] `/account` (dashboard) renders: last 3 orders with status badges and links to order detail (STORY-036), current reward point balance and tier badge linking to the rewards dashboard (STORY-035), a saved/wishlist items count with thumbnails linking to Wishlist (STORY-013), and quick links to Profile, Addresses, Order History, Support, Rewards, and Referrals
- [ ] Dashboard widgets stream in independently via Suspense with per-widget loading skeletons — a slow order-history fetch never blocks the reward-points widget from rendering
- [ ] Each widget defines its own empty state with a CTA: "No orders yet — Shop Now", "You haven't saved anything yet — Browse Products", "Start earning points on your first order"
- [ ] The header's account nav item (STORY-004) reflects auth state: avatar/initials + dropdown (Dashboard, Profile, Logout) when logged in, "Sign In / Register" links when logged out
- [ ] Logout clears the NextAuth session/cookie and redirects to the homepage
- [ ] Dashboard layout is responsive and reuses the `Container`/`Section` primitives from STORY-003 at 375px, 768px, 1024px, and 1440px viewports

## Tasks
- [ ] **Database:** Extend the `User` model (and NextAuth `Account`/`Session`/`VerificationToken` tables from the Prisma adapter set up in STORY-001) with `passwordHash`, `marketingOptIn`, `emailVerified`, `createdAt`. Add a migration.
- [ ] **API:** `src/app/api/auth/[...nextauth]/route.ts` (NextAuth handler), `POST /api/auth/register`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`.
- [ ] **Service:** `auth.service.ts` (register, hash/verify password via bcrypt, issue reset tokens); `customer-dashboard.service.ts` that composes the summary by calling `order.service.ts`, `reward.service.ts`, and `wishlist.service.ts` (each owned by its respective story) — this story does not own order, reward, or wishlist business logic, only the aggregation for the dashboard view.
- [ ] **Frontend:** `src/app/(storefront)/account/layout.tsx` (session guard + account sidebar/tab nav), `src/app/(storefront)/account/page.tsx` (dashboard), `login/page.tsx`, `register/page.tsx`, `forgot-password/page.tsx`, `reset-password/page.tsx`; dashboard widget components (`RecentOrdersCard`, `RewardsSummaryCard`, `SavedItemsCard`, `QuickLinksCard`) under `src/components/storefront/account/`.
- [ ] **Validation:** `src/validation/account/register.schema.ts`, `login.schema.ts`, `forgot-password.schema.ts`, `reset-password.schema.ts` (password complexity rules shared across register/reset).
- [ ] **Testing:** Vitest unit tests for `auth.service.ts` (password hashing, credential verification); Playwright e2e covering register → dashboard → logout, and unauthenticated-access-redirects-to-login-then-back.
- [ ] **Documentation:** Document the NextAuth session strategy and the `/account/*` auth-guard pattern in `docs/architecture-decisions.md` so later Customer Platform stories reuse it instead of re-deriving it.

## Dependencies
- STORY-001 (Project Foundation Setup) — NextAuth scaffold, Prisma singleton, `src/lib/auth.ts` must exist first.
- STORY-002 (Design System & Theming) — form/button/card styling tokens.
- STORY-003 (Global Layout & Responsive Framework) — `Container`/`Section` primitives and provider wiring.
- STORY-004 (Primary Navigation & Header) — the account nav item this story's auth state feeds into.
- STORY-013 (Wishlist), STORY-028 (Order Management), STORY-030 (Rewards / Loyalty Club) — this story's dashboard widgets summarize their data; if any of those stories are not yet built, the corresponding widget must degrade to its empty state rather than error.

## Out of Scope
- OAuth/social login providers (credentials/email only for launch; a future enhancement)
- Full profile and address editing (STORY-034)
- Full reward wallet and referral dashboards (STORY-035)
- Full order history and order detail/tracking (STORY-036)
- Wishlist add/remove interactions themselves (STORY-013)

## References
- `docs/blueprint.md` Section 4 (Site Structure — Customer Portal)
- `docs/blueprint.md` Section 5 (Customer management: registration, login, profiles)
- `docs/blueprint.md` Section 9 item 6 (Customer Platform)
- `docs/folder-structure.md` (`src/app/(storefront)/account/`)
