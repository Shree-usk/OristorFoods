# Architecture Decisions Log

Short, dated entries recording non-obvious choices made while building
ODEP. Not a full ADR process — just enough context so a future session
(human or Claude) doesn't have to re-derive *why* something is the way it
is.

---

## 2026-07-14 — STORY-001 Project Foundation Setup

**Auth.js v5 (`next-auth@beta`), not v4.** Next.js 16 App Router pairs
cleanly with Auth.js v5's route-handler-based API (`src/lib/auth.ts`
exports `handlers`/`auth`/`signIn`/`signOut`; consumed by
`src/app/api/auth/[...nextauth]/route.ts`). This also means the env var is
`AUTH_SECRET`, not the v4-era `NEXTAUTH_SECRET` — `NEXTAUTH_URL` is still
used. `.env.example` reflects this.

**Auth session strategy is `jwt`, not `database`.** The Credentials
provider requires JWT sessions in Auth.js v5. `PrismaAdapter` is still
wired in (for `User`/`Account` persistence and so OAuth providers can be
added later without re-plumbing), but no `Session` rows are written while
only the Credentials provider is active.

**Minimal Auth.js Prisma models added now, not deferred.** `prisma/schema.prisma`
has `User`, `Account`, `Session`, `VerificationToken` — the standard
Auth.js schema — because `PrismaAdapter` cannot compile/run without them.
Full customer profile fields (addresses, reward wallet, etc.) are
explicitly out of scope here and belong to STORY-033/034; admin
roles/permissions belong to STORY-038. Do not bolt product-specific fields
onto `User` in this story.

**Prisma 7 driver-adapter pattern, not a schema-level `url`.** Prisma 7
removed `datasource.url` / `shadowDatabaseUrl` from `schema.prisma` for
the generated client — see the generator's own guidance: pass an
`adapter` (or `accelerateUrl`) to the `PrismaClient` constructor instead.
`src/lib/db.ts` uses `@prisma/adapter-pg` (`PrismaPg`) with `pg` as the
underlying driver, reading `DATABASE_URL` from `process.env` directly.
**Consequence: `DATABASE_URL` must be a plain `postgresql://` connection
string — the `prisma+postgres://` Accelerate/local-proxy URL format that
`npx prisma dev` prints first is NOT compatible with the `pg` driver.**
`prisma.config.ts` still holds `datasource.url` — that one is only for the
Prisma CLI/Migrate, and is a separate mechanism from the application
runtime client.

**Prisma client generator output:** the generated client's actual entry
point is `src/generated/prisma/client.ts`, not the bare
`src/generated/prisma` directory (no `index.ts`/`package.json` is
generated). Import as `@/generated/prisma/client`, not `@/generated/prisma`.

**shadcn UI init used the `base-nova` style / `@base-ui/react`**, not the
classic Radix-based `new-york`/`default` styles — this is whatever the
installed `shadcn@4.13.0` CLI currently defaults to. `components.json` has
`baseColor: "neutral"` as a placeholder; STORY-002 (Design System &
Theming) will remap the CSS variables to the Oristor palette (Ivory,
Charcoal, Oristor Gold, Chilli Red, etc.) — this story intentionally left
shadcn's default theme in place.

**No shadcn `form.tsx` wrapper was generated** (`npx shadcn add form`
produced nothing under this CLI version/style). The React Hook Form + Zod
integration pattern (`src/components/storefront/newsletter-signup-form.tsx`)
wires `useForm` + `zodResolver` directly against the shadcn `Input`/`Label`
primitives instead of a `Form` wrapper component. Feature teams should
follow this pattern unless a `form.tsx` primitive is added later.

### RESOLVED (2026-07-15): local DB connectivity blocker

The original hypothesis in this doc (Windows Firewall/AV blocking
`node.exe` loopback traffic) was **wrong** — disproven by direct evidence:
a raw Postgres wire-protocol handshake from Node, and a query via the
app's actual `pg` driver (the one `@prisma/adapter-pg` uses at runtime),
both connect and complete successfully against `localhost:51214`. TCP and
Node's networking were never the problem.

**Actual root cause:** `npx prisma dev` runs a local Postgres-compatible
server backed by **PGlite** (an embedded/WASM Postgres), not real
PostgreSQL. On the very first `prisma migrate dev` call, the schema-engine
runs `SELECT ... FROM "_prisma_migrations"` over Postgres's *extended
query protocol* as part of its `devDiagnostic` check. Because that table
doesn't exist yet, PGlite mishandles the resulting error and desyncs the
wire protocol — the schema-engine's Rust Postgres connector (`quaint`)
then reads garbage and raises `UnexpectedMessage`, the connection drops,
and Prisma surfaces this as `P1017` ("server has closed the connection").
Confirmed via `DEBUG=* npx prisma migrate dev`, a raw TCP/SSL-negotiation
probe, and cross-referenced with a known upstream report:
[prisma/prisma#29366](https://github.com/prisma/prisma/issues/29366)
(open as of this writing; PGlite also only supports one concurrent
connection, which underlies related reports in that thread).

**Fix for the first-run case (verified, reproduced twice from a clean
`prisma dev` data directory):** pre-create an empty `_prisma_migrations`
table via the *simple* query protocol (`db execute`, which never hits the
buggy code path) before running `migrate dev` for the first time:

```bash
npx prisma dev                                                   # start the local server
npx prisma db execute --file prisma/create_migrations_table.sql  # pre-seed the table
npx prisma migrate dev --name init                               # now succeeds
```

`prisma/create_migrations_table.sql` is committed to the repo for this
purpose.

**Known remaining limitation — do not use `migrate dev` repeatedly:**
even with the above fix, a *second* `prisma migrate dev` call (with or
without schema changes, and even against a freshly restarted server)
reliably fails with `P3006`/`42P07` ("relation already exists") while
replaying the migration against PGlite's shadow database. This reproduces
every time and is the same class of PGlite protocol-desync bug, not stale
state on our side — restarting `prisma dev` does not help. This matches
workarounds reported by other users in the same upstream issue.

**Recommended local workflow until PGlite/Prisma fix this upstream:**
- **Iterating on the schema day-to-day:** use `npx prisma db push`
  (confirmed reliable and idempotent — no shadow database involved, so
  the bug doesn't trigger).
- **Producing a real, committed migration file** (needed once a schema
  change is ready to ship): run `npx prisma migrate dev --name <name>`
  against a **freshly started** `prisma dev` instance (kill it, clear
  `%LOCALAPPDATA%\prisma-dev-nodejs\Data`, restart) so it's the *first*
  `migrate dev` call of that server session — same pre-seed step as
  above applies only if `_prisma_migrations` doesn't already exist.
- **CI / production** should point at real hosted Postgres, where none of
  this applies — `migrate deploy` there is unaffected (no shadow DB, no
  PGlite).

**Also confirmed as a non-issue:** the 300MB+ `durable-streams.sqlite`
file PGlite keeps under `%LOCALAPPDATA%\prisma-dev-nodejs\Data\` is safe
to delete when you want a clean slate — it's local dev-only WAL/stream
state, not anything checked into the repo or shared with teammates.

---

## 2026-07-14 — STORY-002 Design System & Theming

**Token naming convention.** The ten brand colors from `docs/blueprint.md`
Section 2 are raw CSS custom properties in `:root` (`--ivory`, `--charcoal`,
`--gold`, `--chilli`, `--leaf`, `--cream`, `--beige`, `--gold-light`,
`--stone`, `--border-soft`), remapped in the `@theme inline` block in
`src/app/globals.css` as `--color-*` so Tailwind v4 generates matching
utilities automatically: `bg-ivory`, `text-charcoal`, `border-gold`, etc.
**Use these tokens, never raw hex values, in component code** — that's the
entire point of this story. The type scale works the same way:
`text-hero`/`text-h1`/`text-h2`/`text-h3`/`text-h4`/`text-body`/`text-small`/`text-caption`
(each with a matching line-height baked in via Tailwind v4's
`--text-{name}--line-height` convention). Headings (`h1`–`h6`) get
`font-heading` (Cormorant Garamond) automatically via a `@layer base` rule;
everything else defaults to `font-sans`/`font-body` (Inter). For numeric
display (prices, quantities, stats), use the `.font-number` utility class
(Inter SemiBold, tabular figures) — see `src/app/globals.css`.

**Shadcn semantic tokens are remapped onto the brand palette, not left as
Shadcn defaults.** `--primary` → Chilli Red (primary CTA), `--secondary` →
Oristor Gold (premium accent), `--background`/`--card`/`--popover` →
Ivory/Cream, `--muted`/`--accent` → Warm Beige, `--border`/`--input` → Soft
Border, `--ring` → Gold. This means `<Button>` (default variant),
`<Card>`, `<Input>`, etc. all inherit the Oristor look with zero
per-component overrides — verified visually at `/style-guide`.

**No dedicated "error" red exists in the 10-color brand palette** — Chilli
Red is reused for `--destructive` rather than inventing an 11th brand
color not specified in `docs/blueprint.md` Section 2. Revisit only if the
client explicitly wants CTAs and destructive/error states visually
distinguished by hue.

**WCAG AA contrast findings** (computed against the actual hex values,
not eyeballed):
| Pairing | Ratio | AA normal text (≥4.5) | AA large text/UI (≥3.0) |
|---|---|---|---|
| Charcoal on Ivory (body text) | 13.1:1 | ✅ | ✅ |
| Cream on Chilli (primary button) | 6.6:1 | ✅ | ✅ |
| Charcoal on Gold (secondary button) | 6.6:1 | ✅ | ✅ |
| **Stone Grey on Warm Beige (muted text)** | **3.2:1** | ❌ | ✅ |
| **Leaf Green on Ivory (success text)** | **4.0:1** | ❌ (borderline) | ✅ |

**Consequence:** don't use `text-muted-foreground` (Stone Grey) or
`text-leaf` for small body-sized text on light backgrounds — reserve them
for large text (H4+/18px+), icons, badges, and UI chrome, where the 3.0
threshold applies. For small secondary text, use `text-charcoal` at
reduced visual weight (e.g. a lighter font-weight) instead of a lighter
color, or pair Leaf/Stone with `text-cream`/`text-ivory` on a **dark**
surface where the ratio flips favorably. This is a real constraint of the
fixed 10-color brand palette, not a bug — flag it if a future design
mock asks for small grey/green body text on a light background.

**Dark mode is explicitly deferred.** The `@custom-variant dark` selector
is kept in `globals.css` for forward-compatibility, but no `.dark { ... }`
value block exists and `next-themes` was not installed — there is
currently no way to trigger dark mode in the app, so there's no risk of a
silently-broken half-implemented dark theme. To add it later: define a
`.dark { --background: ...; ... }` block with Oristor-appropriate dark
values (do not reuse Shadcn's generic zinc/slate dark defaults), install
`next-themes`, and wire a theme toggle.

**Shadcn `components.json` `baseColor: "neutral"` was left as-is.** This
field only affects which reference palette the CLI diffs against when
generating *new* components going forward — it doesn't affect rendering,
since we override the actual CSS variables directly in `globals.css`.
Oristor's palette isn't one of Shadcn's stock presets (zinc/slate/stone/
gray/neutral), so there's no better preset to pick here.

**Radius/spacing:** `docs/blueprint.md` Section 2 defines colors and
typography but no corner-radius or spacing rhythm. Shadcn's default
`--radius: 0.625rem` (and derived `--radius-sm/md/lg/xl/2xl/3xl/4xl` scale)
was kept as-is — deliberate, not an oversight. Revisit if a client mockup
specifies otherwise.

---

## 2026-07-14 — STORY-003 Global Layout & Responsive Framework

**TanStack Query provider stays at the root layout, not per route-group.**
STORY-003's AC literally asks for it in `(storefront)/layout.tsx`, but a
single `QueryClient` instance shared by both `(storefront)` and `(admin)`
is the correct default — TanStack Query isn't admin-only, and splitting
it would just fragment the cache for no benefit. `src/app/providers.tsx`
(added in STORY-001) already does this at the root. Documented as a
deliberate deviation, not an oversight. When an actual admin-only
provider shows up (e.g. an RBAC context in STORY-038), that's the point
to add `(admin)/layout.tsx`-scoped providers.

**No Zustand "hydration boundary".** `useUiStore` is plain client-only
ephemeral UI state (mobile nav open/closed), not persisted or rehydrated
from the server, so there's no SSR/client hydration mismatch to guard
against — a boundary component would be solving a problem that doesn't
exist yet. Revisit only if a persisted store (`zustand/middleware`
`persist`) is introduced later.

**Header/footer are composition "slots", not empty rendered elements.**
`(storefront)/layout.tsx` marks where STORY-004 (header) and STORY-005
(footer) plug in via comments, rather than rendering empty `<header>`/
`<footer>` landmarks — an empty landmark region is arguably worse for
accessibility than no landmark at all. The layout does render the real
`<main id="main-content">` landmark now, since content exists today and
`#main-content` is there for a future skip-to-content link.

**`Container` and `Section` primitives** live in
`src/components/storefront/layout/` (`container.tsx`, `section.tsx`),
built with `class-variance-authority` to match the existing Shadcn
component pattern (see `button.tsx`). `Container` sizes: `narrow`
(max-w-3xl, body copy/forms), `default` (max-w-7xl, most page content),
`wide` (max-w-[100rem], full-bleed hero/banner sections) — all with a
`px-4 sm:px-6 lg:px-8` gutter. `Section` wraps children in a `Container`
by default (pass `containerSize={false}` to opt out) and controls
vertical rhythm via `spacing`: `sm`/`default`/`lg`/`xl`, each a
`py-*`/`md:py-*` pair. **Use these instead of hand-picked `max-w-*`/`py-*`
combinations in page code.**

**Breakpoints: Tailwind v4 defaults kept, not customized.**
`docs/blueprint.md` doesn't specify a custom breakpoint scale, so `sm`
(640px)/`md` (768px)/`lg` (1024px)/`xl` (1280px)/`2xl` (1536px) are used
as-is. The four required test viewports (375/768/1024/1440) sit within or
at these bands — mobile-first is the primary design target per blueprint
Section 6.

**Sticky-header offset:** a single `--header-height: 4rem` CSS variable
in `globals.css` (`:root`) drives `html { scroll-padding-top:
var(--header-height) }` now, so in-page anchor links don't get hidden
under the header. STORY-004 must update this variable (not hardcode a
new offset elsewhere) if the real header's height ends up different from
the 4rem placeholder.

**`prefers-reduced-motion` / `prefers-color-scheme` exposed at the hook
level**, not just CSS: `src/hooks/use-media-query.ts` (SSR-safe,
`useSyncExternalStore`-based) backs `usePrefersReducedMotion()` and
`usePrefersColorScheme()`. A global CSS `@media (prefers-reduced-motion:
reduce)` rule in `globals.css` also force-shortens all
animations/transitions as a safety net independent of any component
remembering to check the hook. STORY-008 should use the hook rather than
re-deriving the media query.

**Favicon:** generated `src/app/icon.png` (512×512, via `sharp`) from the
existing brand asset `src/assets/logo/Logo.png` (the circular "Oristor
Food Products" badge mark). Next.js's file-based metadata convention
picks this up automatically — no manual `<link rel="icon">` needed. If
the brand team supplies a dedicated simplified favicon mark later
(the circular badge is dense at 16×16), swap this file.

**CLS/Lighthouge caveat — not literally measured.** This story avoided
the known architectural causes of layout shift (fonts via `next/font`
with automatic size-adjust metrics, no client-JS-dependent initial paint,
no unsized images yet), but a full Lighthouse CLS score was not run in
this environment. Formal Lighthouse auditing (the blueprint's ">95"
target) is explicitly STORY-066's job (Quality & Security epic) — treat
this story's CLS acceptance criterion as "architecturally sound," not
"numerically verified."

**Fixed a real testing-infrastructure bug affecting every future RTL
test**, not just this story's: `vitest.config.ts` doesn't set
`test.globals: true`, so Testing Library's automatic `afterEach(cleanup)`
registration (which checks for a global `afterEach`) was silently never
firing. Every `render()` call across a test file was accumulating in
`document.body` instead of being cleaned up between tests, which only
surfaces once a file has 2+ tests asserting against `screen.getBy*`
queries with matches that appear more than once. Fixed by adding an
explicit `afterEach(cleanup)` in `tests/unit/setup.ts`. If a future unit
test mysteriously fails with "found multiple elements" only when run
alongside other tests in the same file (but passes in isolation), this is
already fixed — look elsewhere first.

**Known harness gotcha (not project-specific):** stopping a background
`npm run dev` task via the task-stop mechanism does **not** kill the
underlying `next dev` (Turbopack) child process — it stays bound to port
3000 and has to be killed by PID (`netstat -ano | grep :3000` →
`taskkill //PID <pid> //F`) or the next `npm run dev`/`playwright test`
run fails or silently binds a different port. Check for this if a dev
server or e2e run behaves unexpectedly.

---

## 2026-07-14 — STORY-004 Primary Navigation & Header

**Full desktop nav only from `lg` (1024px), not `md` (768px).** All 13
blueprint nav items (8 primary + 5 action-cluster icons) plus the logo
genuinely don't fit in 768px — a real Playwright overflow test caught
this. Tablet-portrait (768–1023px) keeps the compact `MobileNav` bottom-bar
pattern instead; only `lg`+ shows the full desktop header. This is a
common, deliberate pattern (many e-commerce sites do the same), not a
workaround. If a future design wants a distinct tablet layout, that's a
new decision to make explicitly — don't just widen the `md:flex` again
without re-checking for overflow at 768px.

**Header height is `min-h-(--header-height)`, not a fixed `h-*`.** At
exactly 1024px (the `lg` boundary), "Food Academy" and "Sign In" wrap to
two lines rather than overflowing horizontally (flexbox reflows text
instead of growing the row) — correct, expected responsive behavior. A
fixed header height would have clipped that wrapped second line;
`min-h` lets the sticky header grow instead. This slightly weakens
STORY-003's "header height never changes" CLS guarantee, but only in this
narrow edge case, and growing safely beats clipping content.

**Shadcn's `NavigationMenu`/`DropdownMenu`/`Sheet` (built on
`@base-ui/react`, not Radix) supply keyboard nav, focus trap, outside-click,
and Escape-to-close out of the box** — none of that was hand-rolled.
Two API details worth knowing if you touch this code:
- `NavigationMenuLink`'s `active` prop sets `data-active` as a bare
  boolean attribute (present with an empty string value, **not** the
  string `"true"`) — assert `aria-current="page"` in tests instead, which
  base-ui also sets automatically and is the semantically correct check.
- Base UI's focus-trap uses invisible `aria-hidden` "focus guard"
  sentinel elements (`[data-base-ui-focus-guard]`) just outside the
  trapped region to redirect focus back in — the same technique
  Radix/react-focus-lock use. A tab stop landing on one of those for a
  single frame is correct, not a bug; a real broken trap would land focus
  on unrelated *perceivable* page content instead. See the focus-trap
  test in `tests/e2e/header.spec.ts` for the exact assertion shape.

**Real accessibility bug found and fixed via the axe scan, not just
manually reviewed:** the mobile bottom-nav labels initially used
`text-stone` (Stone Grey, #8A817C) on the Ivory background at 10px —
3.56:1 contrast, which fails WCAG AA's 4.5:1 for normal text (this is
exactly the combination flagged as a caveat in STORY-002's contrast
table, now caught for real by an automated scan rather than staying
theoretical). Fixed by splitting icon color (`text-stone` is fine — icons
only need the 3:1 non-text/UI-component ratio) from label color
(`text-charcoal`, 13:1, comfortably passes). Active state uses
`text-primary` (Chilli Red on Ivory = 6.25:1, also passes) for both.
**Lesson: run the axe scan, don't just trust the STORY-002 contrast table
in the abstract** — it only documented the *general* pairing risk, not
every place it would concretely show up.

**Cart/Wishlist stores are intentionally count-only.** `src/lib/stores/
cart-store.ts` and `wishlist-store.ts` hold nothing but `count` +
increment/decrement/setCount. STORY-024 and STORY-013 own the real line-
item data — extend these stores (derive `count` from real items) rather
than creating parallel ones.

**Search trigger is a wired-but-inert `<button>`**, not a link to a
`/search` page that doesn't exist yet. STORY-007 owns the actual overlay;
this story only provides the click target and correct position in the
header. Don't add search logic to `header-actions.tsx` — extend
STORY-007's own component instead.

**Account menu uses `next-auth/react`'s client-safe `useSession`/`signOut`**,
not the server-oriented `auth`/`signOut` re-exported from `src/lib/auth.ts`
(STORY-001). `SessionProvider` (also `next-auth/react`) was added to
`src/app/providers.tsx` alongside the existing `QueryClientProvider` so
`useSession()` works in any Client Component under the root layout.

---

## 2026-07-14 — STORY-005 Footer

**`lucide-react` v1.x ships zero brand/logo icons.** Facebook, Instagram,
YouTube, Twitter, LinkedIn, GitHub — none of them exist anymore (confirmed
by enumerating all 5,980 exports). Lucide is now a purely generic UI icon
set. Rather than pull in a second icon dependency (e.g. `simple-icons`)
for three glyphs, `src/components/storefront/layout/social-icons.tsx`
hand-rolls minimal inline SVGs for Facebook/Instagram/YouTube. **If more
brand icons are needed later, reconsider a dedicated package instead of
hand-rolling more of these** — three is a reasonable amount to inline,
a dozen would not be.

**Footer uses an intentional dark variant (Charcoal bg / Ivory text)**,
per the AC's explicit option to do so. This is the first dark surface in
the app, and it surfaced a real constraint: the brand's Chilli Red and
Leaf Green were only ever contrast-checked against **light** backgrounds
(STORY-002). Chilli-on-Charcoal measures ~2.1:1 and Leaf-on-Charcoal
~3.3:1 — both fail WCAG AA for text, Chilli badly. Rather than invent
new "-light" color tokens, the newsletter form's error/success messages
use plain Ivory text (13:1, always safe) with a `CircleAlert`/`CircleCheck`
icon to carry the meaning instead of hue — which is also correct per
WCAG 1.4.1 (don't rely on color alone to convey information), not just a
contrast workaround. **If a future story needs red/green status text on
a dark surface, don't reuse raw Chilli/Leaf — either verify a lightened
variant's contrast first or use the icon+neutral-text pattern from
`newsletter-form.tsx`.**

**Newsletter form uses TanStack Query's `useMutation`**, not a bare
`fetch` + local loading state — consistent with the tech stack's existing
server-state library rather than reinventing pending/error/success
tracking by hand.

**Route Handler → Service Layer, no direct Prisma.** `src/app/api/
newsletter/subscribe/route.ts` validates with the shared
`newsletterSubscribeSchema` (also used client-side by the form) and calls
`src/services/newsletter.service.ts`, which is a stub (`console.log` +
resolve) — no real email/CRM integration yet, that's an Enterprise
Platform / Marketing Console epic story. The seam is already in the right
place so swapping in a real provider later doesn't touch the route or
the form.

**Mobile bottom nav overlap:** the footer needs the same `pb-16 lg:pb-0`
reserved-space treatment as `<main>` (STORY-003/004) — otherwise the
fixed `MobileNav` bottom bar covers the footer's last section (legal
row/certification badges) when scrolled to the bottom of the page on
mobile. Any future full-bleed content placed after `<Footer />` in the
storefront layout needs the same consideration.

**Certification badges are explicit placeholders.** "ISO Certified" /
"HACCP Compliant" render as plain text labels (no logo/seal graphics) per
the AC's "space for ... placeholders" — `docs/blueprint.md` doesn't
confirm Oristor actually holds these certifications. **Do not add real
certification seal graphics without verifying the underlying claim first**
— swap the placeholder text for real logos only once the client confirms
which certifications are actually held.

**Contact info (address/phone) is placeholder data**, not a real
registered address — `docs/blueprint.md` doesn't specify one. Flagged in
`src/lib/footer-config.ts` directly; replace before production launch.
STORY-054 (System Settings) will eventually make this admin-editable.

**Test scoping gotcha:** once the footer existed, `tests/e2e/header.spec.ts`'s
previously-unscoped `page.getByRole(...)` lookups started colliding with
identical link labels in the footer (Products, Recipes, Blog, Contact,
Wishlist, About all appear in both). Fixed by scoping those assertions to
`page.locator("header")`. **Exception:** the mega-menu flyout content
(`NavigationMenuContent`) renders in a portal **outside** the `<header>`
DOM subtree (base-ui's `NavigationMenuPositioner` portals it), so
mega-menu-content assertions intentionally stay page-scoped rather than
header-scoped — scoping those to `header` silently breaks them (looks
like a locator bug, is actually a portal). If you add more page sections
with link text that overlaps nav labels, expect to scope new header
tests the same way.

---

## 2026-07-14 — STORY-008 Animation Framework

**Built out of numeric order, before STORY-006/007.** STORY-006
(Homepage) lists STORY-008 as a hard dependency ("scroll-reveal
primitives... consumed by STORY-006"), even though 008 is numbered after
006/007 in the epic. Building 006 first would have meant hand-rolling
throwaway `whileInView` code in every homepage section, then refactoring
all of it once the real primitives existed — so 008 landed first instead.
If you're wondering why the epic's story numbers don't match build order
here, this is why.

### Animation conventions — when to use what

- **`ScrollReveal`** (`src/components/motion/scroll-reveal.tsx`): the
  default for entrance animation on scroll-into-view — homepage sections,
  card grids, any content below the fold. Wraps Framer Motion's
  `whileInView`. Takes `variant` (default `fadeInUp`), `delay`, `repeat`
  (default: animate once), `amount` (visibility fraction to trigger,
  default 0.2).
- **Inline `motion.div`**: use directly only for one-off interactions that
  don't fit the entrance-animation shape (drag, layout animations,
  gesture-driven UI). Don't hand-roll another scroll-reveal wrapper.
- **`hoverLift/tapScale`** (spread props): hover/tap micro-interactions
  for cards and buttons. Spread onto a `motion.*` element:
  `<motion.div {...hoverLift}>`.
- **Standard duration/easing**: `DEFAULT_DURATION = 0.5s`,
  `DEFAULT_EASE = [0.22, 1, 0.36, 1]` (a gentle ease-out) — exported from
  `variants.ts` so new one-off animations stay visually consistent with
  the rest of the site instead of picking arbitrary numbers.

**Every primitive's reduced-motion contract:** when
`useReducedMotion()` is true, `ScrollReveal` and `PageTransition` render
children in a plain wrapper with **no** Framer Motion involvement at
all (not even an instant no-op animation) — simplest possible reduced-
motion path, and it means reduced-motion users pay zero Framer Motion
runtime cost for these two primitives. Any new primitive added to this
module must follow the same pattern: check `useReducedMotion()` first,
bail to a plain render if true.

**`PageTransition` is entrance-only, not full `AnimatePresence` enter/exit.**
A true exit transition needs to delay unmounting the outgoing page until
its animation finishes, which fights the App Router's streaming/Suspense
model — risks blocking or duplicating server-rendered content mid-
navigation. The entrance-only fade (`key={pathname}` on a `motion.div`)
gets the "site feels considered" effect without that fragility. Revisit
only if a specific design explicitly calls for a true exit transition,
and prototype it against a streaming route (e.g. one with `loading.tsx`)
before committing to it.

**`useReducedMotion` doesn't duplicate STORY-003's hook.** It's a thin
re-export of `usePrefersReducedMotion` (`src/hooks/`), scoped under the
motion module's own name so consumers importing from
`@/components/motion` don't need to know it's backed by the same
underlying hook as everywhere else.

### Test infrastructure additions (affect all future tests, not just this story)

**jsdom doesn't implement `matchMedia` or `IntersectionObserver`.**
`tests/unit/setup.ts` now stubs both globally via `vi.stubGlobal` (not
direct `window.x = ...` assignment — that trips a TypeScript quirk where
`"x" in window` narrows to `never` for DOM properties the lib types
already declare as always-present). The `IntersectionObserver` stub was
needed the moment any component using Framer Motion's `whileInView`
(i.e. `ScrollReveal`) got unit-tested — expect to hit this again if
future components use viewport-based APIs (`ResizeObserver`, etc.) and
they're not yet stubbed.

**Playwright's `reducedMotion` fixture is nested under `contextOptions`**,
not a top-level `test.use()` option: `test.use({ contextOptions: {
reducedMotion: "reduce" } })`, not `test.use({ reducedMotion: "reduce" })`
(the latter type-errors — it's a `BrowserContextOptions` field, exposed
indirectly).

**Mega-menu hover flakiness (pre-existing, not introduced by this story):**
stress-testing `tests/e2e/header.spec.ts`'s "Products mega-menu opens on
hover" revealed base-ui's `NavigationMenu` hover-intent tracking doesn't
reliably register from a single synthetic `.hover()` call, and — more
importantly — re-issuing `.hover()` on the same element without moving
away first is often a no-op (no fresh `pointerenter` fires). Fixed with a
retry loop that hovers a neutral element first, then the real target,
wrapped in `expect(...).toPass()`. **If you add more hover-triggered
interaction tests against base-ui components, use this same
neutral-hover-then-target pattern from the start** rather than
rediscovering the flakiness.

---

## 2026-07-14 — STORY-006 Homepage

**"Newsletter" (blueprint Section 4's 12th homepage section) is satisfied
by the existing site-wide `<Footer>`, not a second standalone section.**
STORY-005 already built a fully-functional newsletter form (RHF + Zod +
real API route) inside the footer, which renders immediately after
`page.tsx`'s content in `(storefront)/layout.tsx`. Blueprint's list
technically implies Newsletter and Footer are two separate homepage
sections, but rendering a *second* newsletter signup form directly above
the footer's existing one would duplicate the exact same feature on the
same page — bad UX and a "no duplicate logic" violation. `tests/e2e/
homepage.spec.ts` verifies the newsletter form is present via the footer
rather than expecting an 12th/13th in-page section.

**Real product photography, not gray placeholder boxes.** `public/
images/products/**` already had 43 real Oristor product photos
(jars, gift boxes, export line) checked into the repo. `src/lib/
fixtures/home-fixtures.ts` uses these directly (as plain URL strings,
not `next/image` static imports, since they live in `public/` not
`src/assets/`) instead of inventing placeholder image paths. Recipe
card images reuse product photos as a stand-in with the connection made
explicit ("Chili Paste Deviled Prawns" uses the chili paste jar photo,
etc.) — real recipe photography is STORY-017's job. **Customer Reviews
fixtures are deliberately text-only, no avatar photos** — fabricating
stock headshots for fake testimonials would misrepresent real people;
swap for STORY-015's real submitted reviews (which may carry a
customer-uploaded avatar) instead of sourcing fake portrait photos.

**Shared `TeaserSection` primitive** (`src/components/storefront/home/
teaser-section.tsx`) backs `FoodAcademyTeaser`, `ExportSolutions`, and
`RewardsClubTeaser` — all three are structurally identical (image +
eyebrow + headline + description + CTA, using the shared
`TeaserSectionData` type). Each still gets its own thin wrapper file
(per this story's "independently composable and testable" AC) rather
than three near-duplicate implementations. `ExportSolutions` passes
`reverse` to flip the image/text sides for visual rhythm — that's the
only thing distinguishing it structurally from the other two.

**Retired the STORY-001 scratch `FadeIn` component.** Its own doc
comment said "the real animation primitives... belong to STORY-008" —
STORY-008 landed immediately before this story, so `<HeroBanner>` uses
the real `ScrollReveal` primitive instead, and the unused scratch
component was deleted rather than left as dead code.

**Base UI's `Button` needs `nativeButton={false}` when its `render` prop
points at something other than a real `<button>` element** (e.g.
`render={<Link href="..." />}`) — otherwise it logs a console error every
render ("expected a native `<button>` because `nativeButton` is true").
This bit every CTA button in the homepage (Hero, and all three
`TeaserSection` instances). **Any future `<Button render={<Link .../>}>`
usage anywhere in the codebase needs `nativeButton={false}` too** — this
isn't specific to the homepage, it's a general Base UI Button rule that
just hadn't come up until this story added CTA buttons that navigate via
`next/link` instead of submitting a form or opening a menu.

**Full-page Playwright screenshots can show `ScrollReveal` content as
invisible even though it isn't actually broken.** The very first
`fullPage` screenshot taken of this homepage showed most section grids
as empty (only headings visible) — looked like a severe rendering bug.
It wasn't: Framer Motion's `whileInView` (which `ScrollReveal` uses)
never fired for below-the-fold content because the full-page screenshot
mechanism doesn't scroll the way a real user does, so the
`IntersectionObserver` never triggered and elements stayed at their
`hidden` (opacity: 0) state. Confirmed by re-screenshotting after
manually scrolling in increments (`window.scrollTo` + wait, repeated
down the page) — everything rendered correctly. **When visually
verifying any `ScrollReveal`-wrapped content, scroll through the page in
steps before screenshotting** (see the pattern used for the homepage
screenshots this story), don't rely on a single `fullPage: true` capture
to reflect real user-visible state.

**Section data contract:** every section component takes typed data as
a prop (`src/types/home.ts`) sourced from `home-fixtures.ts` in
`page.tsx` — none of them import fixtures directly themselves. When a
real epic's data is ready (Product Platform, Recipes, Reviews, Food
Academy, Rewards, Export), replace the fixture import in `page.tsx` with
a real query/fetch; the section components themselves shouldn't need to
change as long as the real data satisfies the existing interface.

---

## 2026-07-14 — Real production domain confirmed: oristor.com

The user shared the real Oristor Instagram bio redirect link, which
decodes to `https://oristor.com/Shop` — confirming `oristor.com` as the
real production domain (previously an unverified placeholder).

**Fixed a real conflation bug while wiring this in:** `metadataBase` in
`src/app/layout.tsx` (STORY-003) was reusing `NEXTAUTH_URL` as its
fallback. That's wrong on reflection — `NEXTAUTH_URL` is the auth
callback base and must always track whatever environment is actually
running (`localhost` in dev), whereas `metadataBase` should resolve to
the real public domain regardless of environment (so OG/social-share
image URLs generated from a local dev build still resolve correctly).
Decoupled them: added `NEXT_PUBLIC_SITE_URL` (defaults to
`https://oristor.com` in code, documented in `.env.example` and set in
`.env`), used only for `metadataBase`. `NEXTAUTH_URL` is untouched.

**Still unconfirmed:** the real Instagram/Facebook/YouTube handles
(`src/lib/footer-config.ts`'s `socialLinks` are still placeholder URLs),
and the real company address/phone (`contactInfo`). Only the domain and
existing `hello@oristor.com` email were confirmed by this exchange — the
other placeholders in `footer-config.ts` need real values from the
client before launch, same as previously flagged.

### Branch protection (GitHub settings, not repo code)

`.github/workflows/ci.yml` runs lint/typecheck/unit-tests/build on every
PR to `main`/`develop`, but GitHub does not enforce it as a merge gate
until branch protection rules are turned on on the GitHub side. Document
requirement (to be configured in repo Settings once the repo is pushed to
GitHub, per `docs/blueprint.md` Section 8's Git workflow):
- `main` and `develop`: require the `build-and-test` CI check to pass
  before merging, require at least one PR review, disallow force-push.
- `feature/*`, `release/*`, `hotfix/*`: no protection required, but PRs
  into `main`/`develop` still go through the same CI gate.

---

## 2026-07-15 — STORY-009 Product Catalogue Data Model

**Schema summary (21 models):** `User`/`Account`/`Session`/`VerificationToken`
(Auth.js, STORY-001) plus 17 catalogue models added in this story —
`Category` (self-referential tree), `Brand`, `Collection` (manual or
rule-based via a `rules Json?` field), `Product` (the hub — FKs to `Brand`,
m2m to `Category`/`Collection`/`Allergen`/`Certification`, 1-1 to
`ProductNutrition`/`ProductBundle`), `ProductImage`/`ProductVideo`
(ordered gallery), `ProductIngredient`, `ProductBundle`/`BundleItem`, and
five pricing-tier models — `StandardPrice`, `SalePrice`, `CampaignPrice`,
`CustomerGroupPrice`, `VolumeDiscountTier`.

**Pricing priority order** (implemented in `src/services/pricing.service.ts`,
`resolvePrice()`): campaign > sale > customer-group > volume-discount >
standard — first tier with a currently-active, applicable row wins. Ties
within a tier (e.g. two overlapping `SalePrice` windows) are broken by
most-recently-created row. `VolumeDiscountTier` is the one tier with
additional internal ordering: the highest `minQuantity` that's still `<=`
the requested quantity wins (deepest applicable discount), falling back to
most-recently-created only when two tiers share a `minQuantity`. See the
doc comment directly above `resolvePrice()` for the authoritative
statement of this algorithm.

**Money representation:** every price field is `Decimal @db.Decimal(10, 2)`
(avoids floating-point rounding). Every price row also carries
`currency String @default("LKR")` — a forward-compatible column for the
multi-currency scope blueprint Section 10 leaves unresolved; no conversion
logic exists yet.

**Migration history note:** the original STORY-001 migration
(`20260715034109_init`, auth tables only) was superseded by this story's
consolidated migration, generated via `prisma migrate diff --from-empty
--to-schema` (no database connection needed — avoids the PGlite
shadow-database bug documented in this file's STORY-001 entry above) and
applied via `db execute` + `migrate resolve --applied`. See Task 14 of
`docs/superpowers/plans/2026-07-15-product-catalogue-data-model.md` for
the exact recipe if another consolidated migration is ever needed.

**Blueprint field coverage** (Section 5, Commerce/Catalogue/Pricing
engine paragraphs): SKU/barcode/slug/images/videos/nutrition/
ingredients/allergens/certifications/SEO fields/reward points — all
present on `Product` and its related models, per the acceptance criteria
in STORY-009. All nine pricing models named in the blueprint (standard,
sale, campaign, customer-group, wholesale, distributor, export,
private-label, volume-discount) are covered by the five schema models —
wholesale/distributor/export/private-label are the four `CustomerGroup`
enum values on `CustomerGroupPrice`, not four separate tables, per the
acceptance criteria's own model list.

**Testing infrastructure fixes discovered during this story:**
- **Prisma's AI-agent safety gate.** Prisma 7's CLI detects when it's invoked by an AI coding agent (via `CLAUDECODE`-style env vars) and refuses `db push --force-reset`/`--accept-data-loss` without live, in-conversation human consent — which an automated test hook can never provide. `tests/unit/global-setup.ts` never actually needed those flags: schema changes in this story were purely additive, so plain `db push` suffices. Don't add `--force-reset`/`--accept-data-loss` to any automated script.
- **`Decimal.toFixed(2)`, not `.toString()`, for test assertions.** Prisma's `Decimal` (decimal.js) strips trailing zeros in `.toString()` — `new Prisma.Decimal("18.00").toString()` returns `"18"`. Every Decimal assertion in this story's tests uses `.toFixed(2)` instead.
- **PGlite single-connection limit and sustained-load instability.** The local `prisma dev` server (PGlite-backed) only reliably supports one connection at a time, and independently reproduced to wedge ("Server has closed the connection") after roughly 40-50 seconds of continuous test activity regardless of a fresh data directory — an upstream WASM runtime limitation, not fixable from this codebase. `vitest.config.ts` sets `fileParallelism: false` to avoid concurrent-connection contention within one run. For a full-suite check locally, prefer `npx vitest run <files>` in batches of 5-8 files over a bare `npm run test`, restarting `npx prisma dev` between batches if one wedges.
- **Test data isolation.** `tests/unit/global-setup.ts` truncates all app tables (via `db execute` running a dynamic `TRUNCATE ... CASCADE` script that queries `pg_tables`, excluding `_prisma_migrations`) after `db push`, before every test run — added after discovering that seed data (`prisma/seed.ts`) and several tests' fixture data shared literal SKU/slug values, causing unique-constraint collisions when seeding and testing back-to-back.

---

## 2026-07-16 — STORY-010 Product Listing, Categories & Filters

**Listing query-param contract** (shared by `GET /api/products`, the three
storefront listing pages, and `nuqs`'s client-side URL state —
`src/lib/product-listing-params.ts` / `src/validation/product-listing.schema.ts`):

| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | positive int | `1` | |
| `pageSize` | positive int, max 60 | `24` | Not exposed in the client UI (the `useProductListingParams()` hook never manages it); the three Server Component pages and `GET /api/products` all still read/forward it from the raw query string via `productListingQuerySchema.pick({ pageSize: true })`, so direct callers/tests can override it. `useProductListing()`'s client-side refetches keep reusing whatever `pageSize` the initial server render used (`initialData.pageSize`), not a hardcoded constant — otherwise the first background refetch after hydration would silently discard a non-default `?pageSize=` override. |
| `sort` | `price-asc \| price-desc \| newest \| best-selling \| rating` | `newest` | `best-selling`/`rating` currently fall back to `newest` ordering — no Order/Review data exists yet (Commerce Platform epic, STORY-015). |
| `priceMin`, `priceMax` | number | none | |
| `allergens` | comma-separated string list | none | Selecting an allergen **excludes** products containing it. |
| `certifications` | comma-separated string list (certification ids) | none | Multi-select within this facet is a union (OR). |
| `brands` | comma-separated string list (brand slugs) | none | Multi-select within this facet is a union (OR). |
| `inStock` | `"true" \| "false"` | none | |
| `category` | route param (page routes) / query param (API route only) | — | Never reflected in the page's own URL query string — the client `ProductGrid` reads its scope from a prop, not the URL. |
| `collection` | route param (page routes) / query param (API route only) | — | Same as `category`. |

All malformed/invalid values fall back to their default (via Zod's
`.catch()`, not `.default()` — `.default()` only fills in a *missing* key,
`.catch()` also recovers from a present-but-invalid one) rather than
rejecting the request. STORY-012 (search) is expected to reuse this exact
result shape (`ProductListingResult`) and the
`ProductCard`/`ProductGrid`/`Pagination` components rather than rebuilding
result rendering.

**`resolvePricesForProducts()` bulk pricing.** STORY-009's `resolvePrice()`
issues 5 queries per product; a listing page showing N products can't do
that N times without risking PGlite's single-connection limit. The shared
priority/tie-break logic was extracted into `resolveFromTierData()` so both
the single-product and bulk (`resolvePricesForProducts`, exactly 5 queries
total regardless of N) paths use identical resolution logic.

**Listing filter/sort/pagination happens in memory**, after fetching the
full non-price-filtered candidate set in one query. Deliberate choice given
this catalogue's realistic scale (not millions of rows) — avoids building
DB-level filtering/sorting for a price value that isn't a stored column.
Revisit if the catalogue ever grows enough for this to matter.

**`nuqs` 2.9.0 — import the main package vs. `nuqs/server` carefully.**
The main `"nuqs"` package bundles the client-only `useQueryState(s)` hooks
in the same module as the plain parser primitives (`parseAsInteger` etc.).
Importing that module into a file that ends up in a Server Component's
module graph breaks the parser primitives at runtime
(`parseAsInteger.withDefault is not a function`) — reproduced identically
under both Turbopack and webpack, so this is not a bundler bug. `nuqs/server`
re-exports the same parser primitives without the hooks and is the correct
import for any shared parser-definition file (`product-listing-params.ts`)
that a Server Component might pull in transitively. The client-only
`useQueryStates` hook itself still comes from the main `"nuqs"` package, in
a `"use client"` file.

**Turbopack workspace root inside a worktree.** A worktree created under
`.claude/worktrees/` inside this repo sits next to the main repo's own
`package-lock.json`. Turbopack's root inference picks that sibling lockfile
as the workspace root instead of the worktree itself unless `turbopack.root`
is pinned explicitly in `next.config.ts`, silently bundling from the wrong
`node_modules` and producing a duplicate React instance ("Invalid hook
call" / "Cannot read properties of null (reading 'useId')" in every client
component that calls a hook).

**PGlite wedges under sustained load — also affects e2e, not just Vitest.**
The instability documented in the STORY-009 entry above (restart
`npx prisma dev` if `db push`/tests start erroring with connection
failures) also hits Playwright e2e runs that exercise real DB-backed pages,
and hits `npx prisma db seed` itself. Additionally: `tests/unit/global-setup.ts`
truncates all app data on **every** `npm run test`/`npx vitest run`
invocation — running a unit test between seeding and an e2e run silently
wipes the seed data. Re-seed immediately before running e2e tests, and
avoid running unit tests in between.

**Recommendation (logged, not actioned — out of STORY-010 scope):** the
seed data's product images (`prisma/seed.ts`) reference
`/images/products/*.jpg` paths that return empty/`null` responses in this
environment, producing benign but noisy `next/image` console warnings
during e2e runs. Doesn't affect functional correctness (Playwright
assertions target text/roles/URLs, not images) — worth a real image asset
pass in a future story touching product media.

---

## 2026-09-19 — STORY-011 Product Detail Page: category route moved to resolve a route collision

**`products/[category]` (STORY-010) moved to `products/category/[category]`.**
Next.js's App Router forbids two sibling folders at the same route-tree
position using different dynamic-segment names — `/products/[category]`
(STORY-010's category landing page) and this story's new
`/products/[slug]` (the PDP) could not coexist as siblings under
`products/`. One of the two had to move.

**Why the category route moved instead of renaming `[slug]`:** at the
time of this change, the category route had zero inbound `href`
references anywhere in the shipped app, while `/products/[slug]` was
already deeply embedded across many components (`ProductCard`,
`RelatedProducts`, `RecentlyViewed`, breadcrumbs, JSON-LD, etc.) —
moving the far-less-referenced route was the cheaper, lower-risk change.
It also made the URL space more consistent with the existing
`products/collections/[collection]` sibling pattern (both category and
collection landing pages now sit under a named segment rather than
directly under `products/`).

**What changed:** `src/app/(storefront)/products/[category]/page.tsx` →
`src/app/(storefront)/products/category/[category]/page.tsx` (file move
only, no logic changes). See commit `78e7649`. Two historical
STORY-010 planning docs
(`docs/superpowers/specs/2026-07-16-product-listing-design.md` and
`docs/superpowers/plans/2026-07-16-product-listing-categories-filters.md`)
still described the old path as of this story and were updated to match
— if you're reading either of those docs for routing details, trust the
actual route tree under `src/app/` over the doc if they ever drift again.

---

## 2026-09-20 — STORY-007 Global Search

**Matching logic seam for STORY-061.** `search.service.ts`'s
`searchCatalogue()` does plain case-insensitive substring matching
(`contains`/`mode: "insensitive"`) against product name/SKU — intentional
per this story's scope (no AI/semantic ranking). STORY-061 (AI Smart
Search) replaces the matching logic *inside* `searchCatalogue()` (or the
repository call it makes) with an AI-backed implementation; the storefront
UI (`search-overlay.tsx`, `/search/page.tsx`) and the `SearchResultsPage`
contract do not change. Recipes use the same registered-extension-point
pattern STORY-011 established for PDP reviews/Q&A/recipes
(`search-extensions.ts`'s `registerRecipeSearchProvider`) — Epic 04
registers a real provider when the Recipe data model ships; until then the
Recipes group is simply absent from suggestions/results.

**`pageSize` is load-bearing, not incidental.** The `pageSize` field on
`searchQuerySchema`/`SearchResultsPage` exists specifically so
`useSearchSuggestions` can request a smaller page (5) than the `/search`
results page's default (12) — the same endpoint and contract serve both
the overlay's live suggestions and the full results page, just with a
different page size per caller. It isn't spelled out as a distinct concern
in the original design spec, but removing it would break the overlay's
suggestion count.

**Untested `activeIndex` path into the second suggestion group.** When
Epic 04 (Recipes) registers a real `registerRecipeSearchProvider`, it
should add a test covering `SearchSuggestionsDropdown`/`SearchOverlay`'s
`activeIndex` correctly targeting an item in the *second* rendered group
(Recipes), since the Recipes group is currently always `[]`. That
arrow-key-into-the-second-group code path is unreachable today and so has
no test coverage — expected for now, but worth closing once a real
provider exists.

---

## 2026-09-20 — STORY-012 Product Search & Discovery

**pg_trgm confirmed working on PGlite.** Verified directly before
committing to trigram search as the approach (`CREATE EXTENSION IF NOT
EXISTS pg_trgm` + `similarity()` both succeed against the local `prisma
dev` database) — this project's PGlite compatibility has been a recurring
source of surprises (see the STORY-001 entry above), so this was checked
first rather than assumed.

**Migration applied via the offline file-to-file diff recipe, not
`migrate diff --from-empty` or `migrate dev`.** `migrate diff
--from-migrations` requires a shadow database connection (the exact class
of bug already documented above) — this migration instead diffed the
schema file at the previous commit against the modified schema.prisma
directly (`migrate diff --from-schema <old-file> --to-schema
<new-file> --script`), which needs no database connection at all, then
applied the result by hand-appending the trigram GIN indexes (not
expressible in Prisma's schema language) and using `db execute` +
`migrate resolve --applied` — never `migrate dev`. See Task 1 of
`docs/superpowers/plans/2026-09-20-product-search-discovery.md`.

**The shared `%LOCALAPPDATA%\prisma-dev-nodejs\Data` directory is not
project-local.** It contains a `production-app`-named server's data
alongside this project's `default`-named server on this machine — any
future "reset local dev DB" step must scope deletion to `Data\default\`
and `Data\durable-streams\default\` only, never wipe the whole `Data`
directory.

**`searchCatalogue()` (STORY-007) now delegates its product-matching to
this story's `searchProducts()`** instead of the plain substring match it
shipped with (`searchPublishedProducts`, now deleted) — same external
`SearchResultsPage` contract, better relevance and typo-tolerance.
`SearchOverlay`, `use-search-suggestions.ts`, and `/api/search/route.ts`
were deliberately left untouched (confirmed with the user during this
story's design) — a future story can wire the header overlay's
suggestions to this story's dedicated `/api/products/search/suggestions`
endpoint and `use-product-search-suggestions.ts` hook if the two
suggestion experiences ever need to diverge, but nothing requires that
today.

**Did-you-mean is currently only reachable via category-name typos, not
product-name typos.** `findRankedProductMatches` and
`findClosestNameSuggestion` (`src/repositories/search.repository.ts`)
both use the identical `similarity(name, query) > 0.3` threshold against
product names — so any query close enough to earn a did-you-mean
suggestion for a product name is, by that same threshold, already close
enough to directly match it via rank tier 2, meaning `result.items.length`
is never 0 for that case. Did-you-mean only fires today when a query is a
near-miss on a *category* name (categories are matched only by literal
substring in the ranked-match query, not by similarity) while missing
every product-name/description/ingredient tier. Confirmed live:
`?q=chili+powder` matches `Chilli Powder 100g` directly; `?q=curyy+powderr`
(a category-name typo) triggers did-you-mean. Not fixed in this story —
flagged here as a known characteristic for whoever next tunes the ranking
thresholds.

---

## 2026-09-21 — STORY-013 Wishlist

**Guest→account merge contract:** `POST /api/wishlist/merge` accepts
`{ productIds: string[] }` (max 200), de-dupes against the user's existing
wishlist, and silently drops ids that no longer resolve to a `Published`
product — never a partial-failure response. Triggered automatically by
`WishlistMergeSync` (mounted in `src/app/providers.tsx`) on the
unauthenticated→authenticated session transition, not by a login page's
submit handler — no login page exists yet in this codebase.

**Header wishlist-count integration point (for STORY-004):**
`WishlistBadge` (`src/components/storefront/layout/wishlist-badge.tsx`)
already renders in `HeaderActions` and reads `useWishlistStore`'s
`items.length` directly — no further wiring needed from STORY-004's side.

**Cart wiring is intentionally still the STORY-024 stub.** Wishlist's
move-to-cart/move-all-to-cart buttons call the existing `useAddToCart`
hook (`src/hooks/use-add-to-cart.ts`), which remains permanently
unavailable until STORY-024 replaces it — confirmed with the user as the
scope for this story rather than building any real cart logic here.

**First authenticated API routes in this codebase.** `/api/wishlist`,
`/api/wishlist/[productId]`, and `/api/wishlist/merge` are the first
routes to call `auth()` and require a session — this also required adding
`src/types/next-auth.d.ts` to type `session.user.id` (previously untyped;
`src/lib/auth.ts`'s `session` callback already set it at runtime).

**The repo is now ESM** (`"type": "module"` in package.json, added so
Playwright can load specs that import the Prisma 7 client). Any new
root-level `.js` file is therefore ESM — use `.cjs` if CommonJS is needed.

---

## 2026-09-22 — STORY-014 Product Compare

**No schema change.** Compare reads existing catalogue tables via a new
batch query (`findProductsForCompareByIds`) reusing the exact include
shape `findProductDetailBySlug` (the PDP) already uses, just batched by id
instead of singular by slug.

**Session-only, no persistence, no auth.** `useCompareStore`
(`src/lib/stores/compare-store.ts`) deliberately has no `persist`
middleware, unlike `wishlist-store.ts` — the compare tray clears on
browser restart by design, per the story's acceptance criteria.

**Tray drawer reuses STORY-013's `GET /api/products/by-ids`** for its
thumbnails rather than a second batch-lookup endpoint — no new "public
lightweight product list" route was needed.

**Page-vs-route validation split:** `GET /api/products/compare` strictly
rejects (400) more than 4 or zero ids via `compareIdsSchema`, but
`/products/compare` (the page) uses the same schema and gracefully falls
back to its own empty state on a parse failure rather than erroring —
matching this codebase's established page-degrades/route-rejects
convention.

**Rating gracefully degrades automatically.** `getProductsForCompare`
reuses the existing `getReviewSummary` provider-hook from
`product-detail-extensions.ts` (already defaults to `null` until
STORY-015 registers a real provider) — no special-casing needed for
"STORY-015 not shipped yet."

**Header dropdowns must close themselves on navigation.** The header
stays mounted across client-side navigation, so a Base UI
`DropdownMenu` containing a link stays open after the link is followed —
and its inert overlay then blocks every click on the new page.
`CompareTrayIndicator` is therefore a controlled menu (`open`/
`onOpenChange`) whose Compare link calls `setIsOpen(false)`, the same
pattern `MobileMenuDrawer` uses. Any future header menu with links needs
the same treatment (menus built from `DropdownMenuItem` close on select
and are unaffected).

**Recommendation (logged, not actioned — for STORY-067):** the codebase's
link-styled-as-button pattern, `<Button nativeButton={false}
render={<Link/>}>` (7 call sites, incl. the compare tray, hero banner,
teaser section, wishlist empty state, share buttons), makes Base UI add
`role="button"` to what is really a navigation link, so screen readers
announce it as a button. `buttonVariants()` on a plain `<Link>` (as
`compare-view.tsx`'s empty state already does) keeps link semantics.

---

## 2026-09-23 — STORY-015 Product Reviews & Ratings

**Status lifecycle.** `Review.status` is one of `Pending`, `Approved`,
`Published`, `Rejected`, `Archived`. Allowed moves: Pending→Approved,
Pending→Rejected, Approved→Published, Approved→Rejected,
Published→Archived, Archived→Published. `Rejected` is terminal for now.
**`changeReviewStatus()` in `review.service.ts` is the only way a status
changes.** The STORY-045 moderation console must call it (passing
`{ moderatorId, note }` to fill the reserved `reviewedById`/`reviewedAt`/
`moderatorNote` columns) and must not update `Review.status` directly.

**Stored rating summary.** `ProductRatingSummary` (average, count, and
`count1`–`count5`) is rebuilt inside the same transaction as any status
change into or out of `Published` (`updateStatusAndRecalculate` in
`review.repository.ts`, the only transaction in the codebase so far,
because services can't import Prisma). No row means no Published reviews,
and callers show "No reviews yet", never a 0.0 rating. Future listing-card
ratings and sort-by-rating should read this table. The rebuild locks the
product row (`SELECT ... FOR UPDATE`) and the status update is conditional
on the expected from-status, so two concurrent moderation actions on the
same product can't lose one another's summary update; customer edit and
withdraw writes are likewise conditional on `status = Pending`, so a review
published mid-request can't have its content overwritten or be deleted out
from under the moderator. Deleting users or reviews outside
`review.service.ts` (for example a future account-deletion feature relying
on the `onDelete: Cascade`) skips summary recalculation entirely — such
features must recalculate affected products' summaries through the service.

**PDP wiring and the provider registry.** `registerReviewProviders()` runs
from `src/instrumentation.ts` at server startup (Node runtime only).
`product-detail-extensions.ts` now keeps its providers on `globalThis`,
because Next.js bundles `instrumentation.ts` separately from route code and
module-scoped state wasn't shared between the two. STORY-016 (Q&A) and
Epic 04 (recipes) should register their providers the same way.

**Verified purchase.** `purchase-verification.ts` defaults to `false`
until STORY-028 (Order Management) calls `registerPurchaseVerifier()`. The
flag is captured once, at submission; purchases made after a review was
written don't update it (known gap). The verifier is kept on `globalThis`,
for the same reason as the product-detail providers above.

**Withdraw = delete.** Withdrawing a Pending review deletes it, freeing the
`(productId, userId)` unique slot, so the status enum stays exactly the
blueprint's five values. The API uses `DELETE` for withdraw (the story
listed it under `PATCH`).

**Review photos deferred.** `ReviewImage` exists in the schema but nothing
writes it. Upload waits on a storage provider (blueprint Section 10, open)
and should reuse the Media Library pipeline (STORY-041).

**Publishing reviews without the moderation console.** Locally:
`npm run review:publish -- <reviewId>` (refuses to run with
`NODE_ENV=production`). The seed publishes three demo reviews (chilli
powder and gift set, not curry powder, whose PDP e2e test expects the empty
state) through the same `advanceReviewToPublished()` helper.

**Local database pool cap (`DATABASE_POOL_MAX`).** The local `prisma dev`
server is PGlite, which supports only one connection at a time. The pg
pool defaults to 10, so any concurrent queries (the PDP's `Promise.all`
now makes real review queries) opened several connections and crashed it
deterministically. `src/lib/db.ts` now caps the pool when
`DATABASE_POOL_MAX` is set. This fixes the concurrency crash only: the
separate "PGlite wedges after ~40-50s of continuous test activity"
problem recorded in earlier entries still happens (reconfirmed 2026-09-23:
a full `npm run test` still wedges partway). Run the suite in batches, e.g.
`npx vitest run --shard=N/15`, restarting `prisma dev` when a shard fails
with P1001 / "Connection terminated unexpectedly". **Set `DATABASE_POOL_MAX=1` in every local
`.env` (each git worktree has its own).** CI's real Postgres leaves it
unset and keeps pg's default pool size.

---

## 2026-09-23 — STORY-016 Product Q&A

**Status lifecycle.** `Question.status` is one of `Pending`, `Answered`,
`Approved`, `Published`, `Rejected`. Allowed moves: Pending→Answered,
Pending→Rejected, Answered→Approved, Answered→Rejected, Approved→Published,
Approved→Rejected, Published→Rejected (take down). `Rejected` is terminal.
**`answerQuestion(questionId, answerText, moderatorId)` is the only way into
`Answered`** (it sets `answerText`/`answeredById`/`answeredAt` in the same
write), and **`changeQuestionStatus(questionId, next)` handles every other
move** and refuses `Answered`. Both write conditionally on the status they
read, so concurrent moderation gets a clean 409. The STORY-046 console must
use these two functions and pass `moderatorId`. It is optional only so the
dev tooling can answer without a staff account.

**Answer stored on the question.** One official staff answer per question
(blueprint flow), so the answer is three nullable columns on `Question`
rather than a separate `Answer` table. A future community-answers feature
would add a table.

**Notification hooks (for STORY-032).** `src/services/qa-notifications.ts`
defines `QuestionSubmittedEvent` (notify admin) and `QuestionPublishedEvent`
(notify customer), and `registerQaNotifier({ onQuestionSubmitted,
onQuestionPublished })`. Contract: `qa.service.ts` calls them only after
the database write succeeds, and `notify*()` catches and logs notifier
errors, so delivery problems never fail a submission or a publish. The
registry lives on `globalThis` (register from `src/instrumentation.ts`,
same as the product-detail providers). The default notifier logs a
`[qa-notify]` line. That is the temporary fallback until STORY-032.

**Customer-facing behaviour.** Customers may have any number of open
questions per product. `GET /questions/mine` returns the asker's own
Pending/Answered/Approved questions (never Rejected), shown as "Your
questions awaiting an answer". The public list is Published only, with a
`q` keyword filter: every whitespace-separated word must appear,
case-insensitively, in the question or its answer. (Zod note: `q` is
`.transform(...).optional()`, not `.optional().transform(...)`, so the
inferred query type keeps `q` optional.)

**Shared response helpers.** `unauthorizedResponse` and
`validationErrorResponse` moved from `review-responses.ts` to
`src/lib/api/responses.ts`, and the browser clients' error type is the
generic `ApiError<F>` in `src/lib/api/api-error.ts`. `review-client.ts`
still has its own `ReviewApiError`, and could migrate to `ApiError` later.

**Publishing Q&A without the moderation console.** Locally:
`npm run qa:publish -- <questionId> "<answer text>"` (refuses to run with
`NODE_ENV=production`). The seed publishes three demo Q&A pairs on chilli
powder and the gift set (not curry powder, whose PDP e2e test expects the
empty state) through `advanceQuestionToPublished()`.

**Follow-ups for later stories.** (1) STORY-032 / STORY-065: question
submission has no rate limit, and every submission fires notify-admin —
harmless while the notifier only logs, but add a per-user submission
limit (or batched admin notifications) before real email/SMS delivery is
wired, or a single account can flood admins. (2) STORY-046: unlike
`changeReviewStatus`, `changeQuestionStatus` records no approver/publisher
(`Question` only stores who answered); the moderation console's audit
logging needs either an optional `moderatorId` parameter (non-breaking) or
an audit-log table.

## 2026-09-24 — STORY-017 Recipe Centre Listing

**Content model.** `Recipe` (listing fields only; STORY-018 adds
ingredients, steps, tips, nutrition and product links), `RecipeCategory`,
and dietary tags as a lookup table (`DietaryTag` + `RecipeDietaryTag`), so
admins add tags without a migration. `RecipeStatus` is
`Draft → Review → Approved → Published → Archived` (STORY-043 owns the
transitions). The storefront shows Published recipes only:
`buildRecipeWhere()` always starts with `status: "Published"`. A category
or tag appears on the storefront only if it is Active and has at least one
Published recipe.

Seeded taxonomy: categories Curries, Rice & Grains, Sweets & Desserts,
Beverages, Snacks, Sambols & Condiments; dietary tags Vegetarian, Vegan,
Gluten-Free, Dairy-Free, Nut-Free, Spicy. `cuisine` is a free-text label
on the card, not a filter.

**URL contract** (for STORY-018 related recipes and STORY-022 bookmarks):
`/recipes?category=<slug>&difficulty=easy,medium,hard&time=under-15,15-30,30-60,60-plus&diet=<slug>,<slug>&q=<text>&sort=newest|popular|rating|time&page=<n>`.
`difficulty` and `time` are OR within the list, `diet` is AND (every tag),
and different params AND together. Time ranges are half-open (`15-30` is
15 ≤ t < 30). `GET /api/recipes` takes the same params plus `pageSize`
(default 12, max 48). A malformed or stale query never errors
(`recipeListingQuerySchema` uses `.catch()` everywhere). The story's
`cookTimeMax` / `dietaryTags[]` became `time` / `diet`.

**Total time, not cook time.** Filtering, the "Cook Time" sort and the
card all use `totalTimeMinutes` (prep + cook), which is what a weeknight
cook actually waits for. It's stored for indexing and always derived by
`computeTotalTimeMinutes()` (`src/lib/recipe-time.ts`). STORY-043's
builder must write it through that function.

**Views and ratings.** `viewCount`, `avgRating` and `ratingCount` are
placeholders written only by the seed. STORY-018 increments views on the
detail page. STORY-022 maintains the rating pair, the way
`ProductRatingSummary` works for products.

**Featured recipes.** `Recipe.isFeatured` drives the homepage section
(newest four Published). The section calls `connection()` so it renders
per request, not at build time, and it disappears when nothing is
featured.

**Client caching.** `useRecipeListing` sets `staleTime: 60_000` (matching
review-list/qa-list), so the server-provided first page isn't refetched
immediately after hydration.

**Shared listing components.** `CheckboxOption`, `Pagination`,
`FilterDrawer` (now children-based), `FilterSidebar` (children + label) and
a generic `SortSelect` live in `src/components/storefront/listing/`.
Products use them through `ProductSortSelect`. `toggleValue` and
`escapeLikePattern` moved to `src/lib/`.

**Search registry on globalThis.** `search-extensions.ts` now keeps its
provider on `globalThis` (as `product-detail-extensions.ts` does), because
`src/instrumentation.ts` and route code load separate module copies. The
recipe provider is registered there and feeds header search suggestions.

**Nav.** "Quick & Easy" is `/recipes?difficulty=easy&time=under-15,15-30`.
"Video Recipes" is removed until STORY-019.

## 2026-09-24 — STORY-018 Recipe Detail Page

**Data model.** `RecipeIngredient` (`recipeId`, nullable `productId` FK to
`Product` with `onDelete: SetNull`, nullable `Decimal quantity`, nullable
`unit`, `displayText`, `sortOrder`) and `RecipeStep` (`stepNumber`,
`instruction`, nullable `imageUrl`, unique per recipe). Nutrition
(`nutritionCalories/Protein/Carbs/Fat/Fiber/Sodium`, all nullable `Int`)
plus `chefNotes` and `galleryImageUrls` are flat columns on `Recipe`, not a
sub-model, since nutrition is one-to-one recipe data. Migration
`prisma/migrations/20260924100000_add_recipe_detail`.

**`displayText` contract (important for STORY-043's admin builder).**
`displayText` is the ingredient's name/description only — it never
includes quantity or unit. The rendered ingredient line is composed at
read time as "{scaled quantity} {unit} {displayText}", or just
`displayText` when quantity/unit are null (e.g. "Salt, to taste"). It is
always the authored `displayText`, never the linked product's catalogue
name, which can differ from how the recipe names the ingredient (e.g.
"Oristor chilli powder" in a recipe vs. the product "Chilli Powder 100g").
A bug that substituted the product name for `displayText` was caught in
review and fixed — STORY-043's builder must keep writing `displayText`
independently of any linked `productId`.

**Ingredient→product linking and reverse lookup.** `RecipeIngredient.productId`
is nullable and set at authoring time; STORY-043 owns the authoring UI that
populates it (and every other field this story reads). `getRecipesByProductId`
in `recipe.service.ts` powers "recipes using this product" and is registered
via the existing `registerRecipeSummaryProvider` extension point (from
`product-detail-extensions.ts`, the same pattern reviews and Q&A use) inside
`registerRecipeProviders()` — it is not a public REST route. STORY-011 (PDP)
consumes it in-process. Both STORY-011 and STORY-043 depend on this shape
staying stable.

**Read path.** `GET /api/recipes/[slug]` and the `/recipes/[slug]` page both
go through `getRecipeBySlug` → `findPublishedRecipeBySlug` (Published only;
anything else resolves to null → 404). `getRecipeBySlug` also returns up to
6 related recipes (same category OR same cuisine, Published, excluding
self, most-viewed first) and atomically increments `viewCount` (the Recipe
Centre's "Most Popular" sort reads it).

**Serving-size scaling** is pure client-side math in
`src/lib/recipe-scaling.ts` (whole numbers for count units like eggs or
cloves, one decimal otherwise), bounded 1–50. Only `ServingSizeAdjuster`
and `RecipePrintShareBar` (via the `RecipeDetailView` wrapper that owns
servings state) are Client Components; method, chef notes, and related
recipes stay server-rendered.

**Print is CSS-driven off the live page**, not a separate route: a
`print:hidden` approach hides the Header/Footer/MobileNav (from the
storefront layout) plus breadcrumbs, share bar, and related recipes, so
printing
always reflects the currently adjusted serving size. **Share** reuses the
existing `ShareButtons`, extended with a native Web Share button shown
only when `navigator.share` exists.

**Soft-404 fix / route group.** The Recipe Centre's `loading.tsx`
originally sat at `recipes/` and so wrapped `recipes/[slug]` in a
streaming Suspense boundary; Next.js flushes the 200 status with the
loading shell before `notFound()` runs, so missing/Draft slugs returned
200 with not-found content. Fixed by moving the listing's `page.tsx` /
`loading.tsx` / `error.tsx` into a `recipes/(listing)/` route group so the
boundary covers only `/recipes` (URLs unchanged). **Rule for future
work:** don't add a `loading.tsx` at a segment whose child routes rely on
`notFound()` for a real 404 status.

**Testing note.** Vitest's global setup truncates the dev DB, so reseed
(`npx prisma db execute --file tests/unit/truncate-all.sql` then
`npx tsx --env-file=.env prisma/seed.ts`) before running Playwright e2e
locally.

**Known follow-ups (deferred, not blocking).** Seed ingredients for two
recipes' method steps mention items not in their ingredient list; gallery
thumbnails use decorative `alt=""` because `galleryImageUrls` has no
alt-text field (worth adding when STORY-043 builds the gallery editor);
the seed inlines `computeTotalTimeMinutes` and dietary-tag logic rather
than going through `recipe.service.ts`'s `createRecipe`, because
`NewRecipeInput` doesn't yet carry ingredients/steps — STORY-043 should
extend it and route the seed through the service.

---

## 2026-09-25 — STORY-019 Video Recipes & Cooking Tips

**Video URL normalization/provider detection.** `normalizeVideoUrl(rawUrl)`
(`src/lib/video-url.ts`) accepts a pasted share URL and returns
`{ provider: "Youtube" | "Vimeo" | "SelfHosted", embedId: string | null,
url: string } | null`. Recognized formats: YouTube
(`youtube.com/watch?v=`, `youtu.be/`, `youtube.com/embed/`) and Vimeo
(`vimeo.com/<id>`, `player.vimeo.com/video/<id>`) both extract an
`embedId`; anything else with a valid `http(s)` URL falls through to
`SelfHosted` (`embedId: null`, the URL itself is the playable file) rather
than being rejected — `null` is reserved for an empty string or a URL
whose protocol isn't `http`/`https`. Enum values follow this schema's
existing PascalCase-single-word convention (`Youtube`/`Vimeo`/
`SelfHosted`, not the story text's `YOUTUBE`/`VIMEO`/`SELF_HOSTED`).
Shared by `Recipe.videoUrl`/`videoProvider` and `CookingTip.videoUrl`/
`videoProvider` (same `VideoProvider` enum on both models) — **STORY-043
(Admin Recipes Workflow) and STORY-044 must feed authored video URLs
through this same function** when they add write endpoints, so the
provider/embedId derived at read time stays consistent with what admin
authoring accepted.

**No Zod schema wraps `normalizeVideoUrl` in this story, deliberately.**
This story is read-only/customer-facing — no API route built here accepts
a video URL from a client, so a validation wrapper would have no caller.
`normalizeVideoUrl`'s `null` return already **is** the validation,
consumed directly by `VideoPlayer`. When STORY-043/044 add an admin write
endpoint for `Recipe.videoUrl`/`CookingTip.videoUrl`, wrap this same
function at that boundary: `z.string().refine((url) => normalizeVideoUrl(url)
!== null)` — don't hand-roll a second URL-shape validator.

**Facade/lazy-load pattern for third-party embeds (LCP protection).**
`VideoPlayer` (`src/components/storefront/recipes/video-player.tsx`, a
Client Component) never mounts a YouTube/Vimeo `<iframe>` on initial
render. For `Youtube`/`Vimeo`, it renders a poster image (YouTube:
`https://i.ytimg.com/vi/{id}/hqdefault.jpg`, no extra fetch; Vimeo has no
unauthenticated thumbnail endpoint, so it renders a generic play-button
overlay) behind a "Play video" button; only on click does the real
`<iframe src=".../embed/{id}?autoplay=1">` get mounted. This avoids
paying the third-party embed's network/JS cost on every recipe page load
just to render a page most visitors won't play the video on — the
standard mitigation for third-party video embeds tanking LCP. For
`SelfHosted`, `VideoPlayer` renders the native `<video controls poster={...}>`
element directly, with no click-to-play facade (matching `ProductGallery`'s
existing `<video>` styling) — unlike the `Youtube`/`Vimeo` branches above.
Browsers don't guarantee a "lazy by default" `preload` behavior (defaults
vary and commonly fetch at least metadata on page load), so `VideoPlayer`
sets `preload="metadata"` explicitly to bound the upfront network cost
instead of relying on an assumption about browser defaults.

**`captionsUrl` only applies to `SelfHosted` video.** `VideoPlayer` only
renders a `<track kind="captions" src={captionsUrl}>` when
`provider === "SelfHosted" && captionsUrl` is set. A cross-origin
YouTube/Vimeo `<iframe>` cannot have a caption track injected into it —
captions for those providers come from the provider's own player UI,
outside this app's control. Don't add a `captionsUrl` prop path for the
`Youtube`/`Vimeo` branches; it would silently do nothing.

**Cooking Tips route: `/recipes/cooking-tips`, not `/food-academy/cooking-tips`.**
The story's own task list drafted the route under `food-academy/` before
this was resolved. `docs/blueprint.md` Section 4's site map settles it:
`Recipes (Categories, Details, Video Recipes, Cooking Tips)` lists
Cooking Tips as a sub-item of **Recipes**, while Food Academy is a
separate, sibling top-level nav item (`primaryNavItems` in
`src/lib/nav-config.ts` already has both as distinct entries). Delivered
at `src/app/(storefront)/recipes/cooking-tips/page.tsx` (list, plain
Server Component reading `topic` from `searchParams`) and
`.../cooking-tips/[slug]/page.tsx` (detail) — full rationale in
`docs/superpowers/specs/2026-09-25-video-cooking-tips-design.md`,
decision 1.

**Video Recipes: `/recipes?hasVideo=true` filter, not a separate
`/recipes/videos` page.** The AC offered both options. STORY-017 already
built a URL-driven, query-param filter architecture for `/recipes`
(`recipe-listing-values.ts` → `recipe-listing.schema.ts` →
`recipe-listing-params.ts` → `RecipeListing`/`RecipeFilterControls`), with
an exact precedent for a boolean filter of this shape
(`product-listing-params.ts`'s `inStock`). `hasVideo` was added the same
way: `RecipeFilters.hasVideo` flows from `recipeListingQuerySchema`
through `listRecipes` to `recipe.repository.ts`'s Prisma filter, a
"Has Video" `CheckboxOption` was added to `RecipeFilterControls` (so it
composes with every other filter, not just reachable via a canned link),
and the nav's "Video Recipes" link
(`src/lib/nav-config.ts`) now points at `/recipes?hasVideo=true`. This
reuses the existing `RecipeGrid`/`RecipeCard`/`RecipeListing` stack
(with a new `RecipeCard.hasVideo` boolean driving a `Play`-icon badge on
the card image) instead of duplicating that whole stack behind a second
page — full rationale in the design doc, decision 2.

**`CookingTipStatus` is a plain two-value enum, intentionally.**
`enum CookingTipStatus { Draft Published }` — no moderation/review-pipeline
states, unlike `ReviewStatus`/`QuestionStatus` (customer-submitted content:
Pending → Approved/Rejected → Published) or `RecipeStatus` (multi-stage
authoring: Draft → Review → Approved → Published → Archived). Cooking tips
are admin-authored directly (Epic 07), with no customer-submission or
review stage anywhere in this story's scope — reusing a bigger workflow
enum would model stages that never occur. Only `Published` tips are ever
returned to the storefront (`findPublishedCookingTips` in
`cooking-tip.repository.ts` hardcodes the filter; it does not trust a
caller-supplied status). **STORY-043/044 authoring UI writes this same
two-value enum** — don't reintroduce a review-pipeline state onto
`CookingTip` without a real product requirement for one.

**`CookingTip.bodyContent` is plain text, not markdown/rich-text**,
rendered with `whitespace-pre-line` (same pattern STORY-018 established
for `chefNotes`) so authored line breaks survive without adding a
markdown-parsing dependency for one field. See design doc decision 5.

**`CookingTipProductRef` is a plain forward join** (tip → products only,
via `cooking-tip.repository.ts`'s query that `include`s linked products
when fetching a tip by slug) — no reverse "cooking tips about this
product" provider registered on the Product Detail Page, since no AC in
this story asks for one (unlike STORY-018's recipe↔product reverse
lookup, which STORY-011 explicitly consumes). If a future story wants
that reverse lookup, follow the `registerRecipeSummaryProvider` pattern
from `product-detail-extensions.ts` rather than querying `Product`
directly from a new route.

---

## 2026-09-26 — STORY-020 Food Academy

**`Article`/`Guide`/`Course` content-type split: `bodyContent` vs.
`sections`.** `FoodAcademyEntry.contentType` (`FoodAcademyContentType`
enum: `Article`, `Guide`, `Course` — PascalCase-single-word, following the
same convention correction STORY-019 already made for `VideoProvider`
rather than the story text's `ARTICLE`/`GUIDE`/`COURSE`) decides which of
two content shapes an entry uses. `Article`/`Guide` entries are flat: the
entire body is one markdown string in `FoodAcademyEntry.bodyContent`,
rendered through a single `<MarkdownContent>` call
(`src/app/(storefront)/food-academy/[slug]/page.tsx`). `Course` entries
are multi-part: their real content lives in an ordered `FoodAcademySection[]`
(`sectionNumber`, `title`, `bodyContent` markdown, optional `imageUrl`,
unique-per-entry `sectionNumber`), each rendered through its own
`<MarkdownContent>` call with a heading anchor (`id="section-{n}"`) and
listed in `FoodAcademySectionNav`'s sticky table of contents. A `Course`'s
own `bodyContent` is optional and, when present, renders as a short intro
*before* the sections — it is never a substitute for `sections`, and the
seeded course entry (`mastering-the-art-of-roasted-curry-powder`) leaves
it `null` on purpose to exercise that path (`tests/e2e/food-academy.spec.ts`
asserts the empty-intro block does not render). Any future authoring UI
(Epic 07) must gate the `sections` editor on `contentType === "Course"`
and keep `bodyContent` as the single free-text field for `Article`/`Guide`.

**`<MarkdownContent>` (`src/components/shared/markdown-content.tsx`) is
now the shared, reusable markdown renderer** for the codebase — the first
markdown dependency introduced (`react-markdown` + `remark-gfm`). It
renders straight to React elements rather than raw HTML strings, so raw
HTML embedded in markdown source (a pasted `<script>` tag, an `onerror`
attribute) comes out as inert literal text with no
`dangerouslySetInnerHTML`/sanitizer boundary to get wrong —
`tests/unit/markdown-content.test.tsx` locks this in directly. **Raw HTML
rendering is disabled by default and must stay that way**: do not add
`rehype-raw` (or any plugin that turns markdown-embedded HTML back into
real DOM) without re-examining the sanitization story first, since
`FoodAcademyEntry`/`FoodAcademySection` bodies are seed/admin-authored
text with no server-side sanitizer in front of them today — the safety
property currently comes entirely from `react-markdown` not executing raw
HTML, not from any sanitization step. Future content types (Blog,
STORY-021) should reuse this component rather than rolling a second
markdown renderer.

**`FoodAcademyEntryStatus` is intentionally a plain two-value enum**
(`Draft`, `Published` — no moderation/review-pipeline states), the same
rationale as STORY-019's `CookingTipStatus`: entries are admin-authored
directly (a future Epic 07 admin content module, not yet built), with no
customer-submission or multi-stage review process anywhere in this
story's scope, unlike `RecipeStatus`'s five-stage authoring pipeline. Only
`Published` entries are ever returned to the storefront —
`findPublishedFoodAcademyEntries`/`findFeaturedFoodAcademyEntries`/
`findPublishedFoodAcademyEntryBySlug`/`findRelatedFoodAcademyEntries`
(`src/repositories/food-academy.repository.ts`) all hardcode
`status: "Published"` and, for the list query, strip any caller-supplied
`status` key before composing the `where` (`AND: [{status: "Published"}, restWhere]`)
rather than object-spreading it, so a caller can never widen the
invariant. Don't reintroduce a review-pipeline state onto
`FoodAcademyEntry` without a real product requirement for one.

**`FoodAcademyRecipeRef`/`FoodAcademyProductRef` cross-link pattern: raw
ids in the repository, resolved in the service layer.** Both ref tables
are plain forward joins (entry → `Recipe`/`Product`, cascade delete,
unique compound key, indexed on the far side — mirroring
`CookingTipProductRef`'s shape). `food-academy.repository.ts`'s detail
select (`foodAcademyEntryDetailSelect`) deliberately selects only
`recipeRefs: { select: { recipeId: true } }` and
`productRefs: { select: { productId: true } }` — it never joins
`Recipe`/`Product` fields directly. Resolution happens one layer up, in
`food-academy.service.ts`'s `getEntryBySlug`, via `getRecipesByIds`
(`src/services/recipe.service.ts`, returning the existing minimal
`RecipePreview { id, title, slug, imageSrc }` shape from
`product-detail-extensions.ts` rather than a new type) and
`getProductsByIds` (`src/services/product.service.ts`, returning full
`ProductListItem`s with resolved pricing). Both of those id-resolution
functions independently enforce Published-only
(`findRecipesByIds`/`buildProductListingWhere` both hardcode
`status: "Published"`), so the Food Academy repository/service never has
to re-implement that guard for the cross-linked rows. This split (repo:
ids only; service: resolve + re-guard status) is the pattern future
content types should follow for their own cross-links (e.g. Blog,
STORY-021) rather than each content type's repository independently
joining into `Recipe`/`Product` and deciding for itself what those cards
look like.

---

## 2026-09-27 — STORY-021 Blog

**Scheduled-publish contract: `status: "Published"` AND `publishedAt <=
now()`, and why `Scheduled` needs no separate query branch.** Every
storefront-facing query in `blog.repository.ts`
(`findPublishedBlogPosts`, `findPublishedBlogPostBySlug`,
`findPublishedBlogPostIdBySlug`, `findRelatedBlogPosts`,
`findActiveBlogTags`, `findActiveBlogAuthorsWithPublishedPosts`)
hardcodes `status: "Published"` *and* `publishedAt: { lte: now() }` as a
single, non-negotiable `AND`. **For the record:** only
`findPublishedBlogPosts` actually composes its `where` by calling the
`publishedWhere()` helper (`blog.repository.ts:18-20`); the other five
functions each inline the identical `status: "Published"`/`publishedAt: {
lte: now() }` condition literally at their own call site rather than
calling the helper. All six are independently correct and covered by
`tests/unit/blog-repository.test.ts`, but an earlier draft of this note
overstated it as "every query routes through the shared helper" — that is
not what the code does; only one of the six does. A future cleanup could
route the other five through `publishedWhere()` too (two of them —
`findActiveBlogTags`/`findActiveBlogAuthorsWithPublishedPosts` — apply the
condition inside a nested relation filter rather than at the query's own
top level, so that refactor is not a pure drop-in), but this story ships
with the duplication left in place, invariant intact.
`findPublishedBlogPosts` also strips any caller-supplied `status`/
`publishedAt` from the incoming filter object via destructuring (never a
spread) before composing `where`, mirroring the Food Academy repository's
identical caller-cannot-widen-the-invariant pattern (see the STORY-020
entry above) — `tests/unit/blog-repository.test.ts` ("cannot be overridden
by a caller-supplied status or publishedAt filter") locks this in.
`BlogPostStatus` is a four-value enum (`Draft`/`Scheduled`/`Published`/
`Archived`), but **`Scheduled` never needs its own query branch**: a
`Scheduled` post's `status` is simply not `"Published"`, so the hardcoded
`status: "Published"` equality check excludes it unconditionally,
regardless of what its `publishedAt` holds. The `publishedAt <= now()`
half of the guard exists for a different case entirely — a post an admin
has already flipped to `status: "Published"` with a future `publishedAt`
(the normal shape of "publish this on launch day, dated for that day, and
just leave it Published rather than babysitting a separate Scheduled →
Published flip at the right moment"). The seed's future-dated regression
post (`our-plans-for-next-years-product-lineup`, `publishedAt:
"2099-01-01"`) is deliberately seeded with `status: "Published"`, not
`status: "Scheduled"`, to exercise exactly this case — see
`prisma/seed-blog.ts` and `tests/unit/blog-repository.test.ts`
("excludes Draft, Archived, and Published-but-future-dated posts").
Any future Admin Blog Editor (Epic 07) that adds a real `Scheduled` →
`Published` authoring flip should keep writing `publishedAt` at
authoring time either way — this story's read path already handles both
"authored as Scheduled, flipped to Published later" and "authored as
Published with a future date" identically, since both simply wait for
`publishedAt <= now()` once `status` is `"Published"`.

**`BlogComment` moderation lifecycle mirrors `review.service.ts`'s
state-machine shape exactly, one state smaller.** `blog.service.ts`
defines `allowedCommentTransitions` (`Pending: ["Approved", "Rejected"]`,
`Approved: ["Hidden"]`, `Rejected: []`, `Hidden: []`) plus
`canTransitionComment`/`changeCommentStatus`, the identical
table-plus-single-mutation-function shape `review.service.ts` already
established (`allowedTransitions`/`canTransitionReview`/
`changeReviewStatus`). `BlogCommentStatus` has one fewer state than
`ReviewStatus`: reviews have a separate "Approved but not yet Published"
step (`Approved: ["Published", "Rejected"]`) because publishing a review
is a distinct moderator action from approving it; comments have no
equivalent gap — `Approved` **is** the publicly-visible state for a
comment, so there is no third status to wait in between. `Approved:
["Hidden"]` exists so a moderator can retract a comment after the fact
without deleting the row (audit trail preserved) — this is the only
post-approval transition. `changeCommentStatus`/`advanceCommentToApproved`
exist in `blog.service.ts` as the mechanism intended to walk a seeded
comment from `Pending` to `Approved` through the same state machine a real
moderation action would use; **the actual moderation UI (approve/reject/
hide, with a moderator identity and audit note) is Epic 07's concern**
(STORY-044/045), not built here. **For the record:** `prisma/seed-blog.ts`
does not actually call `advanceCommentToApproved` — it writes each seed
comment's `status` (including `"Approved"`) directly via
`prisma.blogComment.create({ data: { ..., status: comment.status } })`,
bypassing both `createBlogComment`'s Pending-only rule and the moderation
state machine entirely. This differs from the Recipe/Review seeds, which
do route their seed data through their own `advance*ToPublished` helpers.
`advanceCommentToApproved` is currently exercised only by its own unit
test (`tests/unit/blog-service.test.ts`, "advanceCommentToApproved
(dev/seed helper)"), not by the seed script. This story only ever produces
`Pending` comments through the real submission path
(`createBlogComment` hardcodes `status: "Pending"` at the type level — its
input type has no `status` field a caller could set) and renders
`Approved` ones (`blogPostDetailSelect`'s `comments` relation hardcodes
`where: { status: "Approved" }`).

**Recipe/video embed mechanism (`parseBodyBlocks`/`BlogPostBody`) is a
separate, blog-only piece — not a modification of the shared
`<MarkdownContent>`.** `src/lib/blog-body-blocks.ts`'s `parseBodyBlocks`
splits a post's raw `bodyContent` on blank lines into an ordered
`BlogBodyBlock[]` (`{kind: "markdown"}` / `{kind: "recipeEmbed", slug}` /
`{kind: "videoEmbed", url}`), recognizing a block as an embed only when
the *entire* trimmed block is exactly `[[recipe:slug]]` or
`[[video:url]]` — an embed-shaped token appearing mid-paragraph stays
ordinary markdown text. `BlogPostBody` (`blog-post-body.tsx`) then walks
that array, handing each `markdown` block to the existing
`<MarkdownContent>` unmodified, and rendering `recipeEmbed`/`videoEmbed`
blocks with the existing `RecipeCard`/`VideoPlayer` components instead
(reusing STORY-017's card and STORY-019's facade-lazy-load video player
rather than building new ones). This was deliberately built as a
pre-processing step in front of `<MarkdownContent>`, not as a change to
`<MarkdownContent>` itself (e.g. a custom remark/rehype plugin for embed
syntax) — `<MarkdownContent>` is shared with Food Academy
(`FoodAcademyEntry`/`FoodAcademySection` bodies, STORY-020) and Recipes'
`chefNotes`-adjacent rendering, and STORY-020's entry above already
documents that its raw-HTML-disabled safety property must not be
disturbed without re-examining sanitization. Giving Blog its own
block-splitting layer in front of the unchanged renderer means Blog's
embed syntax has zero regression risk to any other content type that
calls `<MarkdownContent>` directly — a bug or behavior change in
`parseBodyBlocks` cannot affect Food Academy or recipe rendering, because
neither of those call paths goes anywhere near it. An unresolvable
`[[recipe:...]]` embed (slug not found, or resolves to a non-Published
recipe — `recipeCards` only ever contains Published cards, resolved via
`getRecipeCardsBySlugs`) renders nothing for that block rather than
literal token text or a broken card (`tests/e2e/blog.spec.ts`, "renders
without crashing and without broken/literal token text").

**Honeypot + DB-based rate-limit spam guard: identity-based, not
IP-based.** The original story task list's wording ("simple rate limit by
IP/session") was not what got built, and this entry documents the actual
mechanism rather than the aspirational one. `submitComment`
(`blog.service.ts`) checks `blogRepository.findRecentCommentByIdentity`
against `BlogComment`'s own table, scoped to the same post and the same
*identity* — `customerId` for an authenticated session, `authorEmail` for
a guest — within a 60-second window (`RATE_LIMIT_WINDOW_MS`). There is no
IP address anywhere in this check: no request-IP capture, no per-IP
counter, no CAPTCHA. This is a deliberate, in-scope choice, not an
oversight — the story's own acceptance criterion is explicit that
submission must be rate-limited/spam-guarded "at minimum with honeypot or
equivalent basic protection (full spam/abuse tooling is not required
here)," and an identity-scoped DB check satisfies that "basic protection"
bar without adding IP-capture plumbing or a third-party CAPTCHA
dependency this story doesn't otherwise need. A future story that wants
real abuse-resistant rate limiting (shared IPs, header spoofing, a bot
rotating email addresses) should treat this as a floor, not a ceiling.

**Gotcha for anyone touching `blogCommentInputSchema` or the comments
route: the honeypot's silent-rejection property must be enforced ONLY in
`submitComment`, never as schema validation.** This was a real bug found
and fixed during this story's build (commit `48c7601`). The design intent
— stated directly in `submitComment`'s own comment (`blog.service.ts:154-158`)
— is that a bot must not be able to distinguish a honeypot rejection, a
rate-limit rejection, and a genuine success from the HTTP response: all
three return the identical `200 {status: "pending-review"}`.
`blogCommentInputSchema.honeypot` was originally `z.string().max(0, "Invalid
submission")`, and since `POST /api/blog/[slug]/comments` runs
`blogCommentInputSchema.safeParse` on the raw request body *before* ever
calling `submitComment`, a real non-empty honeypot value was rejected at
the route with a distinguishable `400` — completely defeating the "can't
tell them apart" property, even though `submitComment`'s own honeypot
check (already correct, already tested in isolation) never got the
chance to run on that request. It slipped through Task 5/6 review because
neither task's tests exercised a non-empty honeypot through the real
route — Task 5 tested `submitComment` directly, and Task 6's route tests
all hardcoded `honeypot: ""`. **The fix, and the rule going forward:**
`honeypot` at the schema layer is shape-validation only (`z.string()`,
no length constraint) — the accept/reject decision belongs entirely to
`submitComment`'s runtime check. Do not reintroduce a `.max(0)` (or any
other honeypot-rejecting) constraint on this field in
`blogCommentInputSchema`, and if a future route ever parses comment input
with a *different* schema before calling `submitComment`, that schema
must make the same choice. `tests/unit/blog-route.test.ts` ("silently
acknowledges a filled honeypot with the same pending-review response,
without persisting a comment") is the regression guard — it exercises the
real route handler, not just the service function, specifically because
that is the layer the original bug lived in.

---

## 2026-09-27 — STORY-022 Recipe Reviews & Bookmarks

**`RecipeBookmark` and `recipe-bookmark.service.ts` are the shared source
of truth for saved recipes — STORY-037 (Saved Recipes & Sync) must consume
`listBookmarksForCustomer(customerId): Promise<RecipeCard[]>` rather than
querying `RecipeBookmark` directly or introducing a second bookmark table.**
`RecipeBookmark` is a flat `{ id, recipeId, customerId, createdAt }` model
with `@@unique([recipeId, customerId])` — deliberately not a
`Wishlist`-style two-table container, since a bookmark is a simple
recipe-to-customer relationship with no need for multiple named lists.
`addBookmark`/`removeBookmark`/`listBookmarksForCustomer`/
`mergeGuestBookmarks` (`src/services/recipe-bookmark.service.ts`) are the
only sanctioned write/read paths; `src/repositories/recipe-bookmark.repository.ts`
is the only file that imports Prisma for this model. STORY-037's
account-side dashboard should call `listBookmarksForCustomer` directly for
its list view.

**`Recipe.avgRating`/`ratingCount` recalculation strategy: service-level
recompute on every status-changing write, inside the same transaction,
row-locked — not a trigger, and not a scheduled job.** Chosen because a
review's status change is already a single, identifiable write path
(`recipe-review.service.ts`'s `changeRecipeReviewStatus`, the only function
that mutates `RecipeReview.status`), so there is exactly one place that
needs to trigger recalculation — a DB trigger or background job would add
operational complexity (migration-managed trigger functions, or a queue
and worker) for no benefit over a direct transactional call at that single
call site. `recipe-review.repository.ts`'s `updateReviewStatusAndRecalculate`
does `SELECT ... FOR UPDATE` on the `Recipe` row before re-aggregating
`AVG(rating)`/`COUNT(*)` over `Approved`-only reviews, so two concurrent
status changes on the same recipe can't produce a lost update (the second
transaction blocks until the first commits, then re-reads the post-commit
state). Zero `Approved` reviews resolves to `avgRating: null`, `ratingCount:
0` — never `0` for the average, matching `Recipe.avgRating`'s existing
nullable-until-rated convention from STORY-017. This is the same pattern
`review.repository.ts`'s `updateStatusAndRecalculate` already established
for `Product`/`ProductRatingSummary` (STORY-015) — any future review-heavy
story needing the same guarantee should reuse this shape (row-lock the
parent, re-aggregate from source rows inside the same transaction, write
back conditionally on the pre-change status) rather than inventing a new
one.

**`RecipeReview`'s lifecycle is intentionally simpler than `Review`'s:**
`Pending → Approved | Rejected`, `Approved → Hidden` — four states, not
`Review`'s five (no separate "Approved but not yet Published" step,
because approval and publication are the same event for recipe reviews).
This mirrors `BlogComment`'s lifecycle shape exactly
(`canTransitionRecipeReview`/`changeRecipeReviewStatus` in
`recipe-review.service.ts` mirror `blog.service.ts`'s
`canTransitionComment`/`changeCommentStatus`), not `review.service.ts`'s
more complex one. No moderator-audit columns (`reviewedById`,
`moderatorNote`, a separate `publishedAt`) exist on `RecipeReview` at this
story's stage — Epic 07's Reviews Moderation Console (STORY-045) can add
them alongside its own UI if it needs them, the same deferral already made
for `BlogComment`.

**Two independent `RecipeNotFoundError` classes exist by design** — one in
`recipe-review.errors.ts`, one in `recipe-bookmark.errors.ts`. Reviews and
Bookmarks import nothing from each other; introducing a shared error
module for one ~10-line class would be exactly the kind of unnecessary
coupling the story's own design spec warned against.

**Seed data fix: `prisma/seed-recipes.ts`'s `avgRating`/`ratingCount` were
previously hardcoded fake numbers (e.g. `sri-lankan-chicken-curry:
avgRating: 4.9, ratingCount: 58`) with zero backing `RecipeReview` rows —
written before this story existed.** Now that these columns are a
review-derived invariant, they were nulled out and replaced with real
`RecipeReview` rows walked through the actual `submitReview`/
`advanceRecipeReviewToApproved` workflow in `prisma/seed.ts` (mirroring how
`prisma/seed.ts` already does this for `Product`/`Review`). Anyone adding a
new seeded recipe with a nonzero `avgRating` in the future must back it
with real seeded reviews the same way — a fake rating with no reviews
behind it is a bug, not a shortcut, once a working review system exists.

**e2e fixture gotcha: a directly-created test `Recipe` needs an explicit
`publishedAt`.** `createRecipe()` (`src/repositories/recipe.repository.ts`)
is a thin passthrough with no default — `publishedAt` stays `null` unless
the caller sets it. `/recipes` defaults to `sort=newest`
(`publishedAt desc, nulls last`), so a fixture recipe with no `publishedAt`
sorts to the very end of the listing and is invisible to any e2e test that
navigates to the listing page rather than the recipe's own detail-page URL
(caught by `recipe-bookmarks.spec.ts`'s "toggling on the recipe card"
test). Every unit-test recipe fixture (`tests/unit/recipe-fixtures.ts`)
already sets `publishedAt`; any e2e spec whose test visits `/recipes`
(rather than only `/recipes/[slug]`) must do the same.

---

## 2026-09-27 — STORY-023 Downloads & Resources

**File storage for `DownloadResource` is local `public/downloads/`, not
cloud storage — this is a deliberate, documented placeholder, not an
oversight.** No cloud storage provider (S3/Cloudinary/etc.) is decided
anywhere in this project (`docs/blueprint.md` Section 10 lists
"hosting/cloud provider specifics" as an open item), and every existing
image asset in this codebase is already a plain `public/images/...` path
with the same limitation. `DownloadResource.fileUrl`/`.thumbnailUrl` follow
that same convention. **The swap point when a provider is chosen:**
`fileUrl` becomes a full external URL, and
`/api/downloads/[slug]/file/route.ts`'s single `readFile(path.join(...,
resource.fileUrl))` call becomes a `fetch(resource.fileUrl)` instead — no
schema change, and the route's `resolveFileAccess`/`recordDownload` call
sites either side of it are unaffected.

**PDF generation uses `@react-pdf/renderer`, not headless-Chromium
print-to-PDF, despite Playwright already being a devDependency.** Chosen
because it needs no browser binary in production — this project's hosting
target is still an open item (blueprint Section 10), and a
headless-Chromium requirement would have constrained that unrelated,
future decision. `recipe-pdf.service.tsx`'s recipe-card PDF and
`prisma/seed-downloads.tsx`'s placeholder guide PDFs both use it directly.
The trade-off: `@react-pdf/renderer` has its own `StyleSheet` API, so none
of the storefront's Tailwind classes carry over — the recipe PDF is a
second, independent rendering of the recipe, not a reuse of STORY-018's
`print:hidden`-CSS browser-print view. **Fonts:** the web app's
`next/font/google` mechanism is a build-time CSS optimization
`@react-pdf/renderer` cannot consume — it needs real font files, registered
via `Font.register()`. This story adds `@fontsource/inter` and
`@fontsource/cormorant-garamond` as dependencies (not devDependencies —
needed at request time) purely to get at their bundled `.woff` files;
`recipe-pdf.service.tsx` registers three weights (`Inter` 400/600/700,
`Cormorant Garamond` 700) once at module load, styled with the brand hex
values from `docs/blueprint.md` Section 2. **Any file containing
`@react-pdf/renderer`'s `<Document>`/`<Page>`/etc. JSX must be `.tsx`, not
`.ts`** — both `recipe-pdf.service.tsx` and `seed-downloads.tsx` needed
this extension; a plain `.ts` file cannot contain JSX regardless of the
project's `jsx` tsconfig setting.

**`downloadCount` increments via the same raw-`$executeRaw`-UPDATE shape as
`Recipe.viewCount`** (`recipe.repository.ts`'s `incrementRecipeViewCount`)
— reused verbatim, not just in spirit, specifically so the increment
doesn't also bump `@updatedAt` (a download is not a content edit). This is
now the second use of this exact pattern in the codebase; any future
counter needing the same atomicity-without-touching-`updatedAt` guarantee
(e.g. a future product/recipe share-count, or STORY-047/STORY-036's future
invoice/packing-slip PDF download tracking, both of which currently
reference PDF generation with no implementation of their own) should reuse
this shape rather than inventing a new one.

**A generated recipe PDF is intentionally not a `DownloadResource` row.**
It has no counter, is never listed on `/downloads`, and is regenerated
fresh on every `GET /api/recipes/[slug]/pdf` request rather than cached —
`@react-pdf/renderer`'s render time for a one-page structured document is
small, and caching would add invalidation complexity (servings/ingredients
can change) for no measured benefit.

**Recipe PDF v1 renders text only — no embedded hero photo.** The AC's
"ingredients + method, respecting the brand's visual identity" doesn't
require the photo, and `@react-pdf/renderer`'s `<Image>` embedding adds a
second filesystem-read path and image-format-compatibility surface for no
AC-required behavior. `recipe.heroImage` is already available on the
`RecipeDetail` `recipe-pdf.service.tsx` receives, so adding it later is a
small, additive change, not a re-architecture.

**Base UI's `Button` (`src/components/ui/button.tsx`, wrapping
`@base-ui/react/button`) always stamps `role="button"` onto whatever it
renders via the `render` prop, even with `nativeButton={false}`.** A
download link built as `<Button render={<a href=... download>}>` is
misrepresented to assistive tech (announced as a button, not a link) and
is invisible to a `getByRole("link", ...)` query — confirmed by inspecting
the actual server-rendered HTML. **When a control needs to be a real
navigable link (has an `href`, especially with `download`), style a plain
`<a>` directly with `buttonVariants({ variant, size })` (exported from
`button.tsx`) instead of routing it through `Button`.** `DownloadCard`'s
own download link already did this; the recipe detail page's "Download
PDF" link (`RecipePrintShareBar`) was fixed to match. This is the first
documented Button-as-link case in this codebase — future ones should start
from `buttonVariants`, not `Button`.

**e2e spec hygiene: every spec file needs its own `beforeEach` fixture
cleanup, even a single-test file.** `recipe-pdf.spec.ts` initially had
none, and a leftover row from one killed run collided with the next run's
fixture creation (`Unique constraint failed on slug`). Every other e2e
spec in this codebase (including this story's own `downloads.spec.ts`)
deletes its fixtures by slug/email prefix in `beforeEach` for exactly this
reason — it is not optional scaffolding, it is what makes a spec safely
rerunnable after an interrupted run.

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

**Resolved 2026-10-01 by STORY-071** (Customer Group & Pricing Context) —
`User.customerGroup` now exists and every call site named above
(including `search.service.ts`, which STORY-071's own AC list omitted
but is the same gap) resolves it from the authenticated customer. See
that story's own architecture-decisions entry.

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

**`cart-store.ts` (the count-only Zustand stub from STORY-004) was fully
retired, not just superseded** — `CartBadge` and `MobileNav` (the plan's
task list named only the former) both switched to `useCart()`, deriving
their displayed count from `cart?.itemCount ?? 0`. `nav-stores.test.ts`,
which tested the store's internals directly, was deleted with it.

**Multi-worktree dev-server gotcha, reconfirmed:** running this story's
`tests/e2e/cart.spec.ts` initially 404'd because Playwright's
`reuseExistingServer: true` reused a stale `npm run dev` process left
running on port 3000 from a *different* story's worktree (STORY-023's),
which obviously has no cart routes. Running two `next dev` instances
against the same worktree's `.next` directory simultaneously is also
unsafe (produces `ChunkLoadError` from concurrent build-cache writes).
Before trusting `reuseExistingServer` in a session that's touched more
than one worktree, check `netstat -ano | grep :3000` and kill anything
not launched from the worktree you're testing.

---

## 2026-09-28 — STORY-025 Checkout

**Checkout ships thin, checkout-facing slices of its three unbuilt
dependency stories** (confirmed with the user): the STORY-026
`PaymentProvider` interface + `MockPaymentProvider` (synchronous
intent → confirm only; webhooks/refunds stay in 026), STORY-027's
city→zone rate resolution (read-only; admin CRUD stays in 055), and
STORY-028's `Order` model + atomic creation (status pipeline,
cancellation, ERP events stay in 028). The full design spec is
`docs/superpowers/specs/2026-09-28-checkout-design.md`.

**Checkout state machine.** Four steps, client-held in
`src/lib/stores/checkout-store.ts` (Zustand, not persisted — **an
unfinished checkout's step state is lost on refresh/browser close by
design**; the server-side cart survives and the customer restarts at
step 1). Allowed transitions: Address → Delivery → Payment → Review,
with back-navigation from any step; changing the address voids the
resolved delivery + intent, and a resolved delivery change voids the
intent (each `set*` action clears everything downstream of it).
Validation gates: each step's Zod schema
(`src/validation/checkout.schema.ts`) is enforced by RHF client-side AND
by the step's API route server-side; Delivery only advances on an "ok"
zone resolution; Payment only advances on a `Succeeded` confirmation;
`place-order` re-derives everything and is the final arbiter. There is
deliberately **no `CheckoutSession` table** — the story's own task list
prefers client state, and the guest-cart cookie already anchors
server-side identity for every step API.

**Server-side calculations are authoritative, everywhere.** No checkout
request body carries an amount. The intent amount is computed from the
live cart + freshly resolved delivery charge; `place-order` recomputes
subtotal/charge/points/grand-total from the database and verifies the
confirmed `Payment.amount` equals the recomputed grand total — a
mismatch (price/stock/charge moved mid-checkout) is a typed
`totals_changed` 409 that sends the customer back with a fresh intent
required. The wizard's displayed numbers are display-only.

**Idempotent order placement without a session table.** The client
generates one `crypto.randomUUID()` idempotency key per checkout
attempt; `Order.idempotencyKey` is DB-unique, and the unique constraint
— not application logic — arbitrates concurrent duplicates
(`order.service.ts` catches the P2002, re-reads the winner, and returns
it after an ownership check against the session user or the order's
snapshotted `guestToken`). The replay check runs *before* the cart
checks, because the first request already cleared the cart. A
`totals_changed` retry regenerates the key (it is a new attempt).

**Order numbers are random, DB-unique, and retried — never `count+1`.**
`ORS-YYYYMMDD-` + 6 chars of Crockford base-32 (no I/L/O/U),
regenerated on a P2002 collision (5 attempts). A sequence/counter table
would serialize order placement for cosmetic sequentiality nobody asked
for.

**Stock decrement is a conditional row update inside the order
transaction.** `updateMany({ where: { id, stockQuantity: { gte: qty } },
data: { stockQuantity: { decrement: qty } } })` per line; zero affected
rows throws and rolls back the entire transaction (order + items +
history + cart clear), so two customers racing the last unit cannot both
succeed and no partial/ghost order can survive a failure at any point.

**Shipping precedence (per `.claude/skills/delivery-zone-pricing`):
campaign override → base zone rate → global free-shipping threshold
applied LAST** (free shipping beats overrides too). Rate models per
zone: `Flat` (`flatAmount`), `WeightBased`/`ValueBased`
(`tiers: [{ upTo, amount }]` ascending, Zod-validated at read time;
past the last tier the last tier's amount applies). Fail-safes, all
typed and none a silent ₨0: unknown city → `no_zone`; weight-based zone
with any cart line missing `Product.weightGrams` → `quote_required`;
missing rate row / malformed tiers / override without an amount →
`config_error`. City matching normalizes both sides (trim, collapse
inner whitespace, lowercase — `normalizeCity()` in
`shipping.service.ts`); an ambiguous city matching multiple active
zones (admin misconfiguration) deterministically picks the
alphabetically-first zone name and logs a warning.

**The order's address is an immutable flattened snapshot** (`ship*`
columns, plus `estimatedDaysMin/Max` and `deliveryZoneName`), and
`OrderItem` snapshots name/SKU/price — later edits to a saved `Address`
row or to products can never alter a historical order. Saved `Address`
rows exist only for authenticated users (STORY-034 later owns their
management); a guest's address lives nowhere but the order snapshot.

**Guest confirmation authorization reuses the cart cookie.** Placing an
order clears the cart's *items* but keeps the cart row and cookie; the
verified guest token is snapshotted onto `Order.guestToken`, and the
confirmation page authorizes by session user OR cookie-token match —
a stranger's request 404s rather than confirming an order number
exists. Payment intent references are unguessable UUIDs and are the
only handle a client ever passes for a payment.

**Open items this story explicitly does not solve:** taxes (nothing is
modeled platform-wide; the Review/confirmation copy states "Prices
include applicable taxes" and `Order.tax` stores 0 — revisit when a tax
rule is confirmed), coupons (`discount`/`couponCode` columns are
reserved for STORY-029; no coupon UI renders), and
`PAYMENT_PROVIDER=mock` is the only valid provider value until the
gateway decision (blueprint Section 10) is made — that is a business
decision, not a technical gap.

## 2026-09-28 — STORY-026 Payment Integration (payment-provider abstraction)

**Scope and why.** `docs/blueprint.md` Section 10 lists the exact payment
gateway provider as an unconfirmed open item, and `CLAUDE.md` says not to
guess at unconfirmed integrations. STORY-025 already landed a checkout-facing
thin slice of this story (the interface, `MockPaymentProvider`'s sync
success/decline/timeout path, `payment.service.ts`'s create-intent/confirm,
and the Payment Step UI). This story completes the remaining scope: refunds,
the async webhook confirmation path, and the abstraction-boundary guard
test — **no concrete gateway (Stripe, PayHere, WebXPay, or any other) is
implemented here.** When the gateway decision is made, a follow-up story
implements a concrete `PaymentProvider` adapter; checkout, cart, and order
code need zero changes at that point — only `getActiveProvider()` in
`payment.service.ts` gains a new branch, and `PAYMENT_PROVIDER=<name>` picks
it.

**`PaymentProvider` contract**
(`src/services/payment/payment-provider.interface.ts`): `createIntent`,
`confirmPayment` (sync), `handleWebhook` (async), `refund`. No method may
ever accept, persist, or log raw card/credential data — any real adapter
must use the gateway's hosted/tokenized flow, the same constraint the mock
already honors by design (it never touches anything card-shaped).

**Webhook signature verification runs over raw bytes, before anything is
trusted.** `/api/payments/webhook`'s route reads the request body as text,
never pre-parsed JSON, and hands the raw string plus the signature header
straight to `PaymentProvider.handleWebhook`. The mock signs/verifies with
HMAC-SHA256 over those exact bytes using `AUTH_SECRET` — reusing the secret
NextAuth already requires rather than provisioning a mock-only one, the same
reasoning `src/lib/cart-token.ts` already uses for the guest-cart cookie.
Content is JSON-parsed and shape-validated (`mockWebhookPayloadSchema`) only
*after* the signature check passes; a bad/missing signature is a 401 and the
payment is left untouched, never assumed valid. This mirrors how a real
provider's webhook verification works (e.g. Stripe's raw-body + signing-secret
pattern) without adopting a specific vendor's SDK.

**This route currently binds to the mock's callback scheme, deliberately.**
Each real gateway defines its own webhook payload shape and signing scheme,
and registers its own callback URL with that gateway — genericizing webhook
ingestion ahead of knowing which gateway would be speculative design against
an unconfirmed integration. When a concrete adapter lands, give it its own
webhook route (e.g. `/api/payments/webhook/<provider>`) rather than
overloading this one.

**Idempotency is shared between the sync and async confirmation paths.**
`payment.service.ts` factors the Succeeded/Failed transition rule into one
internal `applyOutcome()` helper used by both `confirmPayment` and
`handlePaymentWebhook`: an already-Succeeded payment stays Succeeded (a
retried confirm or a duplicate webhook delivery must never flip a completed
payment), and a Failed payment stays Failed — the customer creates a fresh
intent rather than resurrecting either.

**Refund is modeled but only the mock implements it.**
`refundPayment(paymentId, amount?)` looks up the payment by its internal id
(what `Order.paymentId` stores), rejects anything not currently `Succeeded`
(`PaymentRefundNotAllowedError`) and any amount exceeding the original
(`PaymentRefundAmountInvalidError`), then calls `PaymentProvider.refund()`
and marks the row `Refunded`. `MockPaymentProvider.refund()` always succeeds
(there's no external system to fail against) and returns a fake
`mock_refund_...` reference. No route or UI calls this yet — it exists so
STORY-028's return flow and the future admin refund action (STORY-047) have
a stable contract, per this story's explicit scope.

**No duplicate `/api/payments/intent` route.** The story's task list
describes a generic intent-creation endpoint, but STORY-025 already built
`POST /api/checkout/payment/intent`, which does exactly this (creates an
intent via the configured provider, amount computed server-side from the
live cart) and is checkout's only caller today. A second, generic route
that accepted a client-supplied amount would duplicate that logic and
undermine the "server always computes the amount" security decision
checkout already made. If a non-checkout caller needs intent creation later,
it calls `payment.service.createPaymentIntent()` directly or gets its own
purpose-built route — not a bare passthrough to the provider.

**Abstraction-boundary guard test**
(`tests/unit/payment-service-boundary.test.ts`) reads `payment.service.ts`'s
source and asserts every import is internal (`@/...`, relative, or a Node
builtin) and that no known gateway name appears anywhere in the file. It
fails the moment a concrete SDK is imported directly instead of going
through a compliant `PaymentProvider` adapter file.

## 2026-09-28 — STORY-027 Shipping & Delivery Zone Pricing (storefront-facing consumer)

**Scope and status.** Like STORY-026, the STORY-025 checkout merge already
shipped a thin slice of this story: `shipping.service.ts` (zone resolution
by city, all three rate models, free-shipping threshold, campaign-override
precedence), `shipping.repository.ts` (read-only access to `DeliveryZone`/
`DeliveryRate`/`DeliveryRateOverride`/`ShippingSetting`), the checkout
Delivery step UI, and the precedence rule itself are all documented in
detail in the STORY-025 entry above ("Shipping precedence…") — that writeup
is the source of truth for the rate-model and precedence rules and isn't
repeated here. This story's remaining work was closing test-coverage gaps
against STORY-027's specific acceptance criteria, not new application code.

**`.claude/skills/delivery-zone-pricing/SKILL.md` — now reconciled.** The
story's own text flagged this file as missing at authoring time. It exists
now (added alongside/after STORY-025) and was cross-checked line-by-line
against the shipped implementation: city-based zone matching, per-zone rate
type, the global (not per-zone) free-shipping threshold, and
override-beats-base-rate/free-shipping-beats-override precedence all match.
No reconciliation changes were needed.

**Mid-checkout recalculation (AC: "delivery charge recalculates
automatically if the customer changes their address or cart contents")
is satisfied by the existing architecture, not a new mechanism.** Address
changes: `checkout-store.ts`'s `setAddress` action voids `delivery`/`intent`
downstream, and the Delivery step's TanStack Query key is `["checkout-delivery",
city]`, so a new city always refetches. Cart-content changes: there is no
inline cart-editing UI inside the checkout wizard itself (`review-step.tsx`
only displays quantities) — the only way to change the cart mid-checkout is
to navigate to `/cart` (e.g. via the header's cart badge), which fully
unmounts the checkout page. The Zustand checkout store is a module-level
singleton that survives that client-side navigation (step/address aren't
lost), and the Delivery step's query has `staleTime: 0`, so returning to
`/checkout` remounts it and it refetches immediately against the now-current
cart. Combined with `checkout.service.ts` re-deriving the cart/delivery from
the database on every subsequent step (payment intent, place-order), a
stale-looking number on screen can never become a stale charged amount.

**No generic `POST /api/shipping/resolve` route, matching the STORY-026
payments-intent decision.** The story's task list describes an endpoint
that accepts a client-supplied cart summary (subtotal, weight). STORY-025's
`POST /api/checkout/delivery` already resolves delivery for the caller's
*live server-side cart* — it accepts only a city and re-derives subtotal/
weight from the database, the same "server always computes the amount"
posture checkout uses everywhere else. A route that trusted a client-sent
subtotal/weight would be strictly less safe and would duplicate this logic
for no current caller.

**New test coverage added by this story:**
- `tests/unit/shipping-calc.test.ts`: a boundary case just *above* the
  free-shipping threshold with no override involved (the existing tests
  covered exactly-at and just-below).
- `tests/unit/shipping-resolve.test.ts` (new): DB-integration coverage for
  `resolveDelivery()` proving the repository's date-range filter actually
  excludes expired and not-yet-started campaign overrides (falling back to
  the base rate), applies a currently-active one, and excludes an inactive
  zone entirely — `shipping-calc.test.ts` only exercised the pure
  calculation function with hand-built inputs, never the real query.
- `tests/e2e/checkout.spec.ts`: a second delivery zone ("E2E Hill Country")
  with its own base rate and an active campaign override, proving the
  override beats that zone's base rate through the real checkout UI —
  the existing e2e coverage only exercised a single flat-rate zone.

## 2026-09-28 — STORY-028 Order Management (status pipeline, cancellation, ERP hook)

**Scope.** STORY-025/026/027 already shipped a thin slice of order
handling — `Order`/`OrderItem`/`OrderStatusHistory` exist, and checkout can
create an order atomically with a stock decrement — but every order was
created `Confirmed` and stayed there forever; there was no status
pipeline, no cancellation, and no ERP integration hook. This story adds
all three, plus the read APIs STORY-036's future dashboard will consume.
It does not touch coupons (STORY-029), reward-point ledgers (STORY-030),
real notification delivery (STORY-032), or any admin UI (STORY-047) —
none of those exist yet; this story only leaves the plug-in points they
need. Confirmed via direct codebase search: **no admin console or RBAC
exists at all** (`src/app/(admin)/layout.tsx` is an empty placeholder
awaiting STORY-038, `User` has no `role` field, no `AuditLog` model
exists) — so every route here is ownership-checked only (session user or
guest-cookie-token match, the same pattern `getOrderForConfirmation`
already used), and the transition capability an admin action will need
later is a plain internal service function, not a route.

**Status transition table**, in `order.service.ts`'s `isTransitionAllowed()`
(pure, unit-tested against the full cross-product of the enum):

| From | Allowed to |
|---|---|
| PendingConfirmation | Confirmed, Cancelled |
| Confirmed | Processing, Cancelled |
| Processing | Dispatched, Cancelled |
| Dispatched | Delivered, Returned |
| Delivered | Returned |
| Cancelled | *(terminal)* |
| Returned | *(terminal)* |

Self-transitions are illegal everywhere (a repeated/duplicate transition
request is rejected, not silently no-op'd, so a caller bug surfaces
instead of hiding). Cancellation is only reachable through `Processing`
— once `Dispatched`, the only forward path is `Returned`.

**`PendingConfirmation` is currently unreachable.** Checkout only ever
creates an order after payment is verified `Succeeded`
(`checkout.service.ts::placeOrder`), so `createOrderWithStockDecrement`
always writes `status: "Confirmed"` directly — the enum value is kept in
place, reserved for a future pay-later/pay-on-delivery flow, not removed
or forced into use prematurely.

**`transitionOrderStatus(orderId, to, actor)` has no API route.** Per
this story's own scope, an admin-usable capability with no admin auth to
gate a route with is a plain service function — STORY-047 imports it
directly once STORY-038 supplies RBAC. It's guarded twice: the transition
table (`IllegalOrderTransitionError`) and an optimistic-concurrency check
in `order.repository.ts::applyStatusTransition`
(`updateMany({ where: { id, status: expectedCurrent } })`, `count === 0`
throws `ConcurrentTransitionError`) — the same conditional-update pattern
`createOrderWithStockDecrement` already uses for stock, so two concurrent
transition attempts from different assumed starting states can't both
silently succeed.

**Cancellation** (`cancelOrder`) is ownership-checked, gated by the same
`isTransitionAllowed(current, "Cancelled")` check (never a separate,
independently-maintained eligibility list, so the two can't drift), then
one transaction (`cancelOrderWithStockRelease`) that restocks every
line — `stockQuantity: { increment }`, the direct inverse of checkout's
conditional `decrement` — and writes `Cancelled` + `cancelledAt` +
`cancellationReason`. It then calls the already-built
`payment.service.ts::refundPayment(paymentId)` — no refund logic is
reimplemented here.

**Decision: a refund failure does not roll back the cancellation.** By
the time `refundPayment` runs, stock has already been released and could
be resold to another customer — reversing the cancellation at that point
would silently undo something the customer was already told succeeded, a
worse failure mode than a delayed refund. `cancelOrder` instead returns
`refundOutcome: "refunded" | "refund_failed" | "skipped_no_payment"` so
the caller can tell the customer "cancelled; your refund may take longer
than usual" instead of falsely claiming an instant refund. No new schema
field tracks a failed refund — `Payment.status` staying `Succeeded` while
`Order.status` is `Cancelled` is itself the detectable condition a future
admin reconciliation view (STORY-047) can query for.

**No `refundedAt`/`refundReference` column on `Order`.** That state
already lives on `Payment.status` (`Refunded`); duplicating it on `Order`
would create a second source of truth.

**ERP integration hook — a durable outbox, not a call to any named ERP's
API.** Which ERP system is unconfirmed per `docs/blueprint.md` Section 10
— the same treatment STORY-026 gives the payment gateway. New
`OrderIntegrationEvent` model + `order-integration.service.ts`, shaped
after `qa-notifications.ts`'s existing stub/registration pattern (default
`console.info(...not wired yet)` consumer, swappable via a
`globalThis`-held registration point for `instrumentation.ts` once a real
subscriber exists) but backed by a real table, since the AC explicitly
calls for one: `emitOrderEvent(type, orderId, payload)` writes the outbox
row **before** invoking the registered consumer, so a future poll-based
worker has a durable queue to replay from even if today's in-process
consumer call fails. Called from `order.service.ts` only *after* its
triggering transaction has committed (`order.confirmed` at the end of
`createOrder`, `order.cancelled` at the end of `cancelOrder`, both
wrapped so an outbox-write failure can never turn an already-successful
order change into an error response) — never from inside a
`$transaction`, since a side effect must not run against data that might
still roll back. `eventType` is a plain string column (typed as a union
only at the TypeScript boundary) so a future event type never needs a
migration.

**`Order.erpSyncStatus` (business-visible) is distinct from
`OrderIntegrationEvent.status` (outbox-processing plumbing).** The
former is what blueprint Section 7's admin dashboard reads; the latter
just means "the registered consumer call didn't throw." The AC's
"manual/mock sync-status update path" is proven by an exported (never
auto-registered) `mockErpSyncConsumer` that flips `erpSyncStatus` to
`"synced"`/`"sync_cancelled"`, opted into only by
`registerOrderEventConsumer(mockErpSyncConsumer)` in tests.

**API is customer-facing only, no admin route:** `GET /api/orders`
(session-only — a guest has no durable identity to list across visits;
each guest order stays reachable individually via its own cookie),
`GET /api/orders/:orderNumber` (reuses `checkout.service.ts::getConfirmation`,
now extended with `statusHistory`/`erpSyncStatus`/cancellation fields, so
the confirmation page and this route share one mapper), and
`POST /api/orders/:orderNumber/cancel`. Routes use the existing
`orderNumber` convention (STORY-025 already established it everywhere);
the story's own task list's `:id`/`[orderId]` wording is stale.

**Frontend: extend, don't rebuild.** `order-status-timeline.tsx` is a new,
purely presentational component (`{status, statusHistory}` in, pipeline UI
out, no data fetching) so STORY-036's future dashboard can drop it in
unmodified. It's added to the *existing* confirmation page
(`checkout/confirmation/[orderNumber]/page.tsx`, STORY-025) as one new
section — no new page is created. **Deliberately no cancel button on the
confirmation page**: that screen is a one-time "you just paid" moment: a
cancel affordance belongs next to full order detail, which is STORY-036's
page, not this story's. The cancel API is fully built and tested; only
its UI trigger is deferred.

**Testing added:** a table-driven `isTransitionAllowed` test over the
full legal/illegal transition matrix (including the AC's named
`Delivered → PendingConfirmation` case and every self-transition);
DB-integration coverage in `order-service.test.ts` for transitions
(legal, illegal, unknown order), cancellation (restock + refund + history,
rejected past `Dispatched`, stranger rejection, refund-failure-still-
cancels), and integration-event emission (one event per lifecycle action,
the mock ERP-sync path); `order-routes.test.ts` for ownership/401/403/404/409
across all three routes; an e2e spec
(`tests/e2e/order-cancellation.spec.ts`) covering the confirmation page's
status display, a full cancel-and-restock cycle through the real API, and
a stranger's cancellation attempt being rejected.

## 2026-09-28 — STORY-029 Coupons & Promotions

**Scope.** Unlike STORY-026–028, this story is genuinely greenfield — no
prior story shipped a thin slice of coupon/promotion logic, though
`Order.discount`/`Order.couponCode` existed as unpopulated placeholders
since STORY-028. Coupon-code redemption and automatic campaign
promotions, both customer-facing and re-validated at every step, are
built here; admin *authoring* of `Coupon`/`Promotion` rows is STORY-050's
concern — that story is designed to link to these models, not redefine
them.

**`Cart.couponId` is an FK, not a denormalized code.** A cart only ever
needs one active coupon (the confirmed default is no stacking — see
below), and an FK always reflects the coupon's live state rather than a
stale snapshot. **A coupon is deliberately NOT carried over on a
guest→user cart merge** (`mergeGuestCartIntoUser`) — merge already treats
itself as "best effort, revalidate everything" (it silently drops
unavailable/capped guest lines today), and a coupon's eligibility
(min-order-value, scope) depends on the *combined* post-merge cart, which
wasn't known at apply time. The customer sees the coupon input again and
can re-apply.

**A guest's per-customer redemption limit is checked in two phases,
because a guest has no stable identity until the Address step's email —
collected after a coupon could already be applied at the cart step.**
`coupon.service.ts::applyCouponToCart` checks everything except the
per-customer limit for a guest (existence, dates, scope, min-order-value,
and the *global* limit are all enforced immediately — an authenticated
user's per-customer limit IS checked at apply time, since `userId` is
already known). `checkout.service.ts::placeOrder` re-runs the full,
throwing `validateCoupon()` a second time once `guestEmail` exists,
catching a guest who's exhausted their limit only there — the same
"re-validation can still reject at the final step" pattern STORY-025
already established for stock/price/delivery (`TotalsChangedError`,
`CartInvalidError`).

**Stacking/precedence is data-driven (`stackable: Boolean`,
`priority: Int` on both `Coupon` and `Promotion`), not hardcoded** —
STORY-050 doesn't exist yet to configure anything, but the AC demands the
*rule* be configuration, not a redeploy. Default: take-best (the largest
discount wins) between the coupon and every active promotion; multiple
`stackable: true` sources sum instead (capped at the matching subtotal).
Ties: the coupon always beats a promotion of equal value (a customer who
entered a code should see it win, never get silently pre-empted by an
invisible campaign); among tied promotions, lower `priority` wins.

**A `FreeShipping` rule's comparable "value" is the current delivery
charge** — `discount.service.ts::calculateDiscount` takes `deliveryCharge`
as an input specifically so a free-shipping coupon/promotion can compete
on the same numeric scale as a percentage/fixed discount for take-best
purposes (0 if delivery is already free from the zone's own threshold —
no double-dipping). This is a refinement discovered during
implementation, not originally planned as a `calculateDiscount` parameter
— the alternative (treating free-shipping as an orthogonal, always-wins
track) was rejected as needless complexity with no real-world case to
justify it yet.

**Discount is computed parallel to delivery, not inside it — an explicit
scope boundary.** `shipping.service.ts`'s free-shipping-threshold and
weight-tier logic keeps using the cart's *pre-discount* subtotal,
completely untouched by this story. `checkout.service.ts` calls
`resolveDiscountForCart` alongside `resolveDelivery`, the same
independent-step pattern it already uses for payment. When a
`FreeShipping` rule wins, the checkout orchestrator (not
`shipping.service.ts`) zeroes the delivery charge actually billed —
matching how the zone's own global threshold already sets `charge = 0`
directly rather than modeling shipping waivers as a subtotal discount
line; `Order.deliveryCharge` reflects the real (possibly zeroed) amount,
and `Order.discount` never double-counts a waived delivery charge.

**Composition with STORY-009 tier pricing**: discounts are computed
against cart lines' already tier-priced `lineTotal` — `cart.service.ts`'s
`buildSummary` has already called `resolvePrice()` (campaign > sale >
customerGroup > volumeDiscount > standard) by the time a line reaches
`discount.service.ts`. A distributor's coupon therefore discounts their
already-discounted total, not the retail price — this falls out of where
the calculation reads its input, with no special-casing and no new
restriction on which customer groups may use coupons (nothing in the
story or blueprint asks for one).

**`CampaignPrice` (STORY-009, per-product price override resolved in
`pricing.service.ts`) and `Promotion` (this story, cart-level discount)
are related but operate at different layers — do not conflate them.**
`CampaignPrice` feeds into a line's `unitPrice`/`lineTotal` before
discount calculation ever runs; `Promotion` is evaluated against the
(already `CampaignPrice`-adjusted, if applicable) cart as a whole.

**Scope (all products / category / product) uses join tables**
(`CouponScopeProduct`/`CouponScopeCategory`, mirrored for `Promotion`),
not a single nullable FK — a real coupon needs to cover several
categories/products at once. A scoped discount is computed only against
matching lines' total, never the full subtotal, and is capped so it can
never exceed that matching sum.

**Redemption is recorded only when the coupon actually won a non-zero
share of the applied discount(s).** A coupon that was validly applied but
lost to a better promotion under take-best contributes nothing — counting
it as "redeemed" would consume the customer's usage allowance for a
discount they never received. `order.repository.ts::createOrderWithStockDecrement`
writes the `CouponRedemption` row inside the same transaction as stock
decrement and order creation (extending, not duplicating, the existing
single-transaction pattern) — a rollback (e.g. insufficient stock) can
never leave an orphaned redemption. The cart's `couponId` is cleared
alongside its items once an order is placed, so the next cart starts
fresh.

**No `refundedAt`-style extra column, no speculative STORY-050 fields.**
`Order` gains exactly one new column, `discountLabel` (a plain
display-string snapshot — "Coupon SAVE10" or "Weekend Sale, Coupon
SAVE10" if stacked — not an FK, so it survives a later-deleted/
deactivated `Coupon`/`Promotion` row unchanged).

**Testing:** `discount-calc.test.ts` — the pure `calculateDiscount()`
function against all three discount types, scope filtering, the
min-order-value boundary, stacking vs. take-best, every tie-break rule,
and over-discount clamping. `coupon-service.test.ts` — every apply-time
validation failure mode, live recalculation on cart change (no re-apply
needed), the guest two-phase limit check end-to-end, redemption-
transaction atomicity, tier-pricing composition, and merge-drops-the-
coupon. `promotion-service.test.ts` — active-window and scope filtering.
`coupon-routes.test.ts` — `POST`/`DELETE /api/cart/coupon` for both
session and guest identities. `tests/e2e/coupon-checkout.spec.ts` — below
minimum rejected with a specific, actionable reason → crosses the
threshold → applies → carries through checkout unchanged → confirmation
page shows the discount and its label; a second scenario proves removal
reverts the total.

## 2026-09-28 — STORY-030 Rewards / Loyalty Club

**Scope.** Like STORY-029, this is genuinely greenfield — `Product.rewardPoints`
and `Order.rewardPointsEarned`/`OrderItem.rewardPointsEarned` already exist
and are already correctly computed and snapshotted by checkout
(STORY-024/025/028), but nothing turned that number into a real loyalty
program: no ledger, no tier progression, no badges, no earn/clawback
wiring into STORY-028's order-event hook. The "admin-configured rules"
the AC keeps referencing belong to STORY-049 (Rewards & Referrals
Campaign Management), which doesn't exist yet — following the same
precedent STORY-027/029 already established, this story builds the real,
data-driven configuration schema itself (seeded with sensible defaults)
rather than hardcoding values or blocking on an admin story that isn't
scheduled yet.

**1. The ledger is signed and split into two distinct derived sums that
must never be conflated.** `RewardTransaction.points` is signed
(`Earned` > 0, everything else ≤ 0), so balance is a trivial `SUM(points)`.
Two sums matter: **spendable balance** = sum across all transaction
types, and **lifetime achievement** (what tier is evaluated against) =
sum of `Earned` + `Reversed` only. This means redeeming or letting points
expire never demotes a customer's tier — only an actual order
cancellation (which nets its `Earned`/`Reversed` pair to zero) can move
achievement, exactly as a real loyalty program should behave.
`rewards.repository.ts::getBalances` computes both sums from one
`groupBy` query rather than two separate queries.

**2. Redemption is written inside the same order-creation transaction as
stock decrement**, mirroring STORY-029's `CouponRedemption` exactly — a
rollback (insufficient stock) rolls back the points debit too, so "a
failed order never leaves points debited with nothing to show" is true
by construction, not by a compensating fix-up
(`order.repository.ts::createOrderWithStockDecrement` calls
`rewards.repository.ts::createRedeemedTransaction` inside the same
`$transaction`, right after the coupon-redemption write). A
`@@unique([orderId, type])` constraint on the ledger makes both this and
event-driven earning idempotent — an order can legitimately hold at most
one `Earned`, one `Reversed`, and one `Redeemed` row (an order can
validly have both an `Earned` and a `Redeemed` row: points it earns on
confirmation, and separately, points the customer spent at that same
order's checkout).

**3. Earning stays on STORY-028's async event hook, redemption doesn't.**
Earning is a downstream consequence of an order reaching `Confirmed`
(fired via `order.confirmed`), so it goes through the decoupled
`order-integration.service.ts` pipeline that already exists for exactly
this purpose — `rewards.service.ts` exports `rewardsConsumer`, registered
in `instrumentation.ts` alongside the review/QA/recipe providers.
Redemption gates the order the customer is placing right now, so it's
synchronous and transactional, called directly from
`checkout.service.ts::createIntentForCart`/`placeOrder`. This asymmetry
is deliberate: an event consumer can't reject the checkout it's reacting
to, but redemption must be able to.

**A real architectural gap, surfaced rather than silently worked
around: `order-integration.service.ts` only supports one registered
consumer at a time.** This story becomes that one consumer. STORY-031
(referral payouts) and a future notifications story will also want the
same `order.confirmed`/`order.cancelled` hook and will collide with this
registration. Turning the single slot into a proper fan-out list is a
real fix, but it's out of scope for this story to build pre-emptively —
recorded here as a known gap for whichever story hits it next.

**`order.service.ts` gained a two-line payload addition** (`userId:
order.userId`) at both existing `emitOrderEvent` call sites — the only
gap found in the existing hook, since a reward consumer needs to know
who to credit and only `orderId` was passed to the consumer separately
before this story.

**4. Redemption is authenticated-only — there is no guest points UI or
logic at all.** A guest has no ledger to redeem from. The redemption
control (`PointsRedemptionInput`, parallel to STORY-029's `CouponInput`)
lives only in the checkout **Review** step, not the cart page or drawer —
the amount worth redeeming depends on the final payable total, which
isn't settled until delivery is resolved. It layers as an *additional*
reduction on top of whatever coupon/promotion discount already won:
`grandTotal = (subtotal − couponPromoDiscount + delivery) − pointsRedemptionValue`
— never competing with coupons/promotions for take-best/stacking, since
spending your own balance isn't a marketing discount.

**Two-tier validation, mirroring coupon.service.ts exactly.**
`resolvePointsRedemptionForCart` is a silent-skip read (never throws —
a guest, a zero request, or an unconfigured rate all just mean "no
redemption applies"), used for the payment-intent amount.
`validateRedemptionAtPlaceOrder` is the throwing final check at
`placeOrder`'s last word, re-validating balance/cap/rate exactly as
coupon re-validation already does for price/stock/delivery drift.

**5. Expiry is real but deliberately simplified, not perfect FIFO batch
accounting.** Each `Earned` row gets its own `expiresAt` (from an
admin-configurable `RewardSetting.pointsExpiryDays`, null = never
expires — off by default, since no admin UI exists yet to turn it on). A
lazy, on-read sweep (`rewards.service.ts::sweepExpiredPointsForUser`,
run before every balance read and before place-order redemption
validation) closes out any batch past its expiry with a linked `Expired`
transaction, **capped at the customer's current spendable balance** so
it can never drive the balance negative even if some of that batch was
already spent. This is an explicit, documented simplification (not
batch-level "which points were spent first" tracking) — justified
because the feature is off by default today and the AC itself frames
expiry as conditional.

**6. Badges, once earned, are never revoked on order cancellation** —
unlike points. A milestone badge reflects behavior that happened;
clawing it back because an unrelated later order cancelled would be
customer-hostile and isn't asked for by the AC. Only the points
themselves reverse. `evaluateTierAndBadges` re-evaluates tier on every
credit/reversal (which can legitimately demote it) but only ever adds
`CustomerBadge` rows, never removes one.

**Badge criteria is an extensible string (`Badge.criteriaType`), not an
enum** — mirrors `OrderIntegrationEvent.eventType`'s precedent, so a new
criteria type never needs a migration. `badgeCriteriaMet()` dispatches on
it and fails safe (badge not awarded) for an unrecognized value, the same
fail-safe treatment the AC asks for missing/unavailable admin config.
Two criteria types ship seeded (`first_order`, `order_count`); a third,
`lifetime_points`, is implemented and ready but has no seeded badge using
it yet.

**Badge milestone counting deliberately uses a looser rule than the
points ledger.** `order.repository.ts::countOrdersByUserId` counts ALL
orders regardless of status (including later-cancelled ones) — a
customer who genuinely placed 5 orders earned a "loyal customer" badge
for that behavior even if one of the five was later cancelled, whereas
the points ledger's strict `Earned`+`Reversed` clawback exists
specifically to prevent point-farming via buy-then-cancel. These are
different concerns with intentionally different strictness.

**7. No second, order-value-based earning formula is built.** The AC's
"and/or" wording allows for one, but the existing per-product
calculation (STORY-024/025) is already shipped, tested, and the sole
mechanism in production. `RewardSetting.orderValuePointsRate` is reserved
for later but unread by any code here — building real dual-mode
selection logic without a concrete admin UI to configure it would be
speculative.

**Tier evaluation is a global, unscoped ladder by design.**
`evaluateTierAndBadges` reads every active `RewardTier` row
(`listTiersAscending`) and assigns the highest one whose
`minLifetimePoints` the customer's lifetime achievement meets or
exceeds — there is one tier ladder for the whole business, not one per
segment/customer-group, matching how the AC and blueprint describe
tiers. Seeded defaults: Bronze (0), Silver (1000), Gold (5000).

**Layering note, to prevent an import cycle:** `rewards.service.ts` may
import `cart.service.ts` (for `getCartSummaryById`, used by
`applyPointsToCart`/`removePointsFromCart`). `cart.service.ts`, in turn,
reads `rewards.repository.ts` + `rewards-calc.ts` **directly** for its
own points-preview computation in `buildSummary` — never through
`rewards.service.ts` — so the two services can never form a cycle. This
mirrors exactly how `discount.service.ts` is the shared lower-level
dependency both `cart.service.ts` and `coupon.service.ts` depend on
without those two importing each other.

**No `RewardSetting` row is seeded by default.** Its absence, not a
schema default, is what keeps redemption and expiry off — an admin
turning on the loyalty program (once STORY-049 exists) does so by
creating the row, not by flipping a boolean. Seeded `RewardTier`/`Badge`
rows are the exception: tier progression needs *some* thresholds to mean
anything, unlike redemption/expiry, which are meaningfully "off" by
absence.

**Testing:** `rewards-calc.test.ts` — the pure `calculatePointsRedemption()`
function against disabled/invalid input, every individual cap, several
simultaneous caps together, fractional flooring, and rounding.
`rewards-service.test.ts` — earn-on-confirm and clawback-on-cancel
idempotency (via the `@@unique([orderId, type])` constraint), tier
boundary transitions (exactly at the threshold vs. one point under),
clawback-driven tier demotion, badge award triggers and no-double-award
and no-revocation-on-cancel, every redemption-validation error path, the
expiry sweep's capping behavior, and redemption-transaction atomicity (a
forced stock failure leaves zero ledger rows — the core AC).
`rewards-routes.test.ts` — all four endpoints' auth/validation/error
paths. `order-service.test.ts` extended with an assertion that both
`order.confirmed` and `order.cancelled` payloads now carry `userId`.
`tests/e2e/rewards-redemption.spec.ts` — place an order as a signed-in
customer, confirm points credited via the balance API, redeem on a
second order through the real checkout Review-step UI, confirm the
discount, grand total, and post-order balance all land correctly.
`tests/e2e/order-cancellation.spec.ts` gained one assertion that
cancelling an order claws back its points and can demote a tier.

## 2026-09-29 — STORY-031 Referral Programme

**A hard blocker, resolved before any referral mechanics could be
built: no customer registration flow existed anywhere in this
codebase.** `src/lib/auth.ts` only ever *checked* an existing
`passwordHash` via its Credentials provider — there was no
`/api/auth/register` route, no sign-up page, no Zod schema for it, and
every seeded demo user had `passwordHash: null` (uncreatable via login).
Since this story's central AC — "a new customer registers while
carrying a referral attribution" — is literally impossible to exercise
without a registration flow, the user explicitly confirmed building a
small, deliberately unpolished one now rather than deferring it:
`POST /api/auth/register` (email+password, `bcrypt.hash` reusing the
same `bcryptjs` dependency `auth.ts` already depends on, no email
verification, no password reset) plus bare `/account/register` and
`/account/login` pages (React Hook Form + Zod, mirroring
`address-step.tsx`'s form pattern). The client signs the customer in via
`next-auth/react`'s `signIn()` right after registration succeeds —
session creation itself is untouched, still entirely NextAuth's
Credentials flow. Full account management (profile editing, password
reset, email verification) is explicitly not this story's job.

**1. Attribution lives only in a signed cookie until registration — no
DB row on a mere click**, mirroring the guest-cart pattern exactly
(cheap, spam-proof, no write fires on every referral-link visit).
`src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts` in
v16.0.0 — using the old name/export produces a deprecation warning and,
per the framework's own migration notes, is on a path to removal) reads
`?ref=<code>` on **every** entry page, not just the homepage, and signs
+ sets the cookie via `src/lib/referral-token.ts`. Unlike the guest-cart
token (an opaque random value looked up in the DB), this cookie carries
meaningful data directly — `{code, ts}` — so registration-time code can
independently enforce the *admin-configured* attribution window without
a DB round trip from inside the proxy. The signer deliberately uses the
Web Crypto API (`crypto.subtle`) rather than `node:crypto` like
`cart-token.ts`: Next.js 16 defaults Proxy to the Node.js runtime (a
change from Edge-by-default in earlier versions, discovered mid-story
via a genuine "Failed to open database" startup error traced to a
corrupted Turbopack cache, not Prisma), and Web Crypto works correctly
under either runtime — not coupled to whichever one happens to be the
current default. A later `?ref=` visit overwrites the cookie (last-touch
attribution); a plain visit with no query param leaves any existing
cookie untouched. Whether the code actually resolves to a real, active
customer is checked only at registration (a Node.js route) — an
unknown/expired code silently produces no attribution, per the AC.

**2. `ReferralAttribution` is created exactly once, at registration**,
with a unique FK on `referredUserId` — structurally impossible to
double-attribute the same customer later, satisfying the AC's "not
re-attributable afterward" requirement by construction rather than by a
runtime check. Status starts `Registered`, moves to `Qualified` when a
qualifying order confirms, or `Excluded` (with a free-text
`excludedReason`, mirroring `Badge.criteriaType`'s "extensible string,
not enum" precedent) if the self-referral guard trips.

**3. The referral bonus reuses STORY-030's existing idempotency
mechanism instead of inventing a new one — and this required two new
`RewardTransactionType` values, not one, to avoid a real collision.**
`ReferralBonus` is written with `orderId` set to the *referred
customer's* qualifying order (even though the transaction's `userId` is
the *referrer* — nothing in the schema requires those to match).
Because `@@unique([orderId, type])` is global, this makes "at most one
referral bonus per qualifying order" true by construction. Reversing it
on cancellation could not reuse the existing `Reversed` type: STORY-030's
own `reversePointsForCancelledOrder` already writes a `type: "Reversed"`
row against that *same* `orderId` (to claw back the referred customer's
own order-earned points) — reusing `Reversed` for the referral-bonus
reversal would collide on that unique constraint. Hence
`ReferralBonusReversed` as its own type. A third new type,
`ReferralWelcomeBonus`, covers the referred customer's optional signup
bonus, credited once at registration (inside the same transaction that
creates the `ReferralAttribution` row) — no separate idempotency guard
needed since registration itself only happens once. None of the three
new types count toward `lifetimeAchievement`/tier progression (only
`Earned`/`Reversed` do, per STORY-030's existing `getBalances` — no code
change was needed there, since the achievement sum already ignores any
type it doesn't explicitly list): a deliberate choice to keep tier
progression tied to a customer's own purchase behavior, not bonuses
earned by referring others or a signup gift.

**4. Qualification is checked on every `order.confirmed` for a still-
`Registered` attribution, not hardcoded to "first order."** The AC's
"e.g. first order... above a minimum value" is an example, not a
mandate; the qualifying check (`referral.service.ts::handleQualifyingCheck`)
compares the confirmed order's `subtotal` against
`ReferralSetting.minQualifyingOrderValue` (null = any order qualifies)
every time, until the attribution's own status guard (`!== "Registered"`)
makes it a no-op — this status check is the *primary* idempotency
guard; the `@@unique([orderId, type])`-driven P2002 catch alongside it
is defense-in-depth against a genuine race, not the main mechanism.
Cancelling the qualifying order reverses the bonus
(`handleCancellationReversal`, subscribed to `order.cancelled` too) and
reverts the attribution back to `Registered` — mirroring STORY-030's own
clawback discipline; buy-then-cancel shouldn't pay out here either. The
reversal reads the *original* credited amount back from the ledger
(`rewardsRepository.findTransactionByOrderAndType`) rather than
re-reading current settings, so a later admin config change can never
alter the size of a reversal for a bonus already paid.

**5. Payout is points-only for now.** `coupon.repository.ts` has no
function to programmatically create a new `Coupon` row — confirmed
during planning, and building one is real, separate scope. Mirrors
STORY-030's own "no second earning mode without a concrete admin UI to
configure it" precedent (see its decision 7): the AC's "points and/or a
coupon, per admin configuration" is satisfied by the points path;
coupon-type payout is left unbuilt, not silently implied to exist.

**6. `ReferralSetting` is seeded with real working defaults — unlike
`RewardSetting`, deliberately not left absent.** An unconfigured
referral program pays out nothing at all, so `prisma/seed-referrals.ts`
ships a `referrerBonusPoints: 100, attributionWindowDays: 30` row by
default (minimum order value and the referred customer's welcome bonus
stay null — genuinely optional per the AC's own "if any" wording). The
admin CRUD for these values is STORY-049's.

**7. Self-referral guard is exactly what the AC asks for "at minimum":
same-email.** Since `User.email` is already unique-constrained, the
only realistic way to exercise this is a referrer's own email matching
the newly-registering account's email at the point of comparison (tested
directly rather than via two real colliding rows, which the DB
constraint itself would reject). Payment-method fingerprinting, which
the AC also mentions as a possible signal, would need new infrastructure
this story doesn't otherwise touch — out of scope, noted here rather
than silently ignored.

**8. `order-integration.service.ts`'s single-consumer slot became a
fan-out list — the exact fix STORY-030's own docs flagged as the next
story's problem.** `holder.consumer: OrderEventConsumer` (a plain
overwrite) became `holder.consumers: OrderEventConsumer[]`;
`registerOrderEventConsumer` now appends; `emitOrderEvent` loops every
registered consumer independently try/caught (one consumer's failure
never blocks another) and falls back to the logging consumer only when
the array is empty (never alongside real consumers). The event is
marked `Processed` only if every consumer succeeded, `Failed` with the
first error otherwise. Neither `registerOrderEventConsumer`'s nor
`resetOrderEventConsumerForTesting`'s signature changed, so no existing
call site needed updating — `instrumentation.ts` simply gained one more
registration call (`referralConsumer`, alongside STORY-030's
`rewardsConsumer`).

**Testing:** `referral-service.test.ts` — code generation and
per-user uniqueness, valid/expired-window/unknown-code/self-referral
attribution outcomes, qualifying-order payout issued exactly once
(including a second qualifying order for the same referred customer
never double-paying), the minimum-order-value gate, and — the test that
most directly proves decision 3 — cancelling a qualifying order reverses
the bonus without colliding with the referred customer's own points
clawback on that same order, with both registered consumers
(`rewardsConsumer` + `referralConsumer`) active simultaneously, matching
production. `order-integration-fanout.test.ts` — every registered
consumer invoked for the same event, one consumer's failure not blocking
another (but still marking the event `Failed`), and the logging fallback
when nothing is registered. `auth-register-routes.test.ts` and
`referral-routes.test.ts` — the registration and read-endpoint
auth/validation paths. `tests/e2e/referral-signup.spec.ts` — the full
real-browser path: land via `?ref=<code>` → register → auto-sign-in →
place a qualifying order → confirm the referrer's ledger balance
increased by the configured bonus.

## 2026-09-29 — STORY-032 Notifications (Email/SMS/WhatsApp)

**Scope.** Every prior commerce story (STORY-028/030/031) fires the
business event a notification would key off of, but nothing sent
anything — there was no email/SMS/WhatsApp capability anywhere in this
codebase. `newsletter.service.ts::subscribe()` (confirmed by reading it)
is a pure `console.log`-and-return stub with no persistence and no real
send — not a foundation to build on. This story builds the real,
provider-agnostic transactional notification service, mirroring
STORY-026's `payment.service.ts`/`src/services/payment/` mock-provider
pattern exactly, since that is this codebase's own established
precedent for "swappable provider behind a common interface, mock by
default." Transactional (event-triggered, one-to-one) only — bulk
marketing campaigns are STORY-050's.

**A real gap closed as part of this story, not a pre-existing feature
reused: order dispatched/delivered had no event to trigger on at all.**
`order.service.ts::transitionOrderStatus` — the only place `Dispatched`/
`Delivered` are ever reached — never called `emitOrderEvent` before this
story; only `createOrder`/`cancelOrder` did. `OrderEventType` is a plain
string union with no other coupling (the `OrderIntegrationEvent.eventType`
column is untyped `String` by design, so a new value never needs a
migration), so widening it to include `"order.dispatched"`/
`"order.delivered"` and emitting both from `transitionOrderStatus`
(after `applyStatusTransition`'s own transaction has already committed,
matching the existing confirmed/cancelled emission point exactly) was a
small, safe addition — not new architecture.

**1. Two different trigger mechanisms, chosen per how the underlying
fact is actually observed — deliberately not "route everything through
one event bus."** Order-lifecycle notifications (confirmed/dispatched/
delivered/cancelled) are genuinely event-driven: `notificationsConsumer`
(a new `OrderEventConsumer`) subscribes to `order-integration.service.ts`'s
fan-out, exactly like STORY-030/031's `rewardsConsumer`/`referralConsumer`
— zero changes to `order.service.ts`'s business logic beyond the two new
`emitOrderEvent` calls dispatched/delivered needed anyway. Points-earned
and referral-qualified are different in a way that matters:
`rewards.service.ts::creditPointsForConfirmedOrder` and
`referral.service.ts::handleQualifyingCheck` **already run inside their
own order-event consumers**, and only they know whether a given
`order.confirmed` delivery was a genuine new credit/qualification or an
idempotent no-op replay — the bare event payload can't tell a third,
independent consumer that without redundantly re-deriving the same
computation (real drift risk, and duplicate logic). So for these two,
`sendNotification` is called directly, synchronously, from inside the
success path of those existing functions — never the idempotent-replay
catch branch — which is exactly what the AC's task list literally asks
for ("wire notification triggers into rewards.service.ts... calling
notification.service.ts"), not a second consumer on the same bus.

**2. The duplicate-send guard's `triggeringEventId` deliberately spans
multiple source tables as a plain string, not a strict FK** — mirroring
`OrderIntegrationEvent.eventType`'s own "plain string for future
extensibility" precedent. For order-lifecycle notifications it's
`OrderIntegrationEvent.id`; for points-earned it's the new
`RewardTransaction.id`; for referral-qualified it's
`ReferralAttribution.id`. A real bug caught and fixed during
implementation: `NotificationLog`'s original unique constraint was
`(triggeringEventId, templateKey, recipient)` — **missing `channel`** —
which meant two different channels resolving to the same recipient value
(most concretely: SMS and WhatsApp both falling back to the same
`"(none)"` no-contact placeholder when neither has a phone on file)
collided with each other, silently dropping the second channel's log row
entirely. The constraint is `(triggeringEventId, templateKey, channel,
recipient)`. `notification.service.ts::sendNotification` checks for an
existing log row first (a clean idempotent short-circuit — no provider
call at all on a repeat) with the unique constraint as defense-in-depth,
matching this codebase's established "primary guard + P2002 catch"
idiom.

**3. A real, working email adapter — Nodemailer, auto-falling-back to an
Ethereal sandbox account when no SMTP is configured.** No email library
existed in this codebase before this story (confirmed: not in
`package.json`, no SMTP vars in `.env`) — `nodemailer`
(+`@types/nodemailer`) is a new dependency, noted here explicitly.
`src/services/notification/email.provider.ts` reads `SMTP_HOST` — if
set, uses a real SMTP transport; if unset, calls
`nodemailer.createTestAccount()` to auto-provision a free Ethereal
sandbox inbox and logs the preview URL for every send. Verified working
end to end during implementation (both a standalone script and the
`tests/e2e/order-notifications.spec.ts` real-browser test actually send
through Ethereal — this is the one test in the suite that deliberately
exercises the real network-backed adapter; every other test mocks
`EmailProvider` via `vi.hoisted`, since a unit/DB-integration test
should not depend on external network availability). SMS/WhatsApp
providers stay mock-only (`sms.provider.ts`/`whatsapp.provider.ts`,
mirroring `MockPaymentProvider`'s shape) — no provider is named in the
blueprint; `notification.service.ts::getProviderForChannel` still reads
a `SMS_PROVIDER`/`WHATSAPP_PROVIDER` env var (default `"mock"`, mirrors
`payment.service.ts::getActiveProvider` exactly, including throwing
`NotificationProviderUnconfiguredError` for anything else) so a real
provider slots in later without touching call sites. Provider instances
are cached per channel at module scope in `notification.service.ts`
(not re-constructed per send) — re-provisioning a fresh Ethereal test
account on every single email would be needlessly slow and would
scatter previews across many different throwaway inboxes.

**4. Email is default-on for transactional notifications; SMS/WhatsApp
require both an explicit opt-in AND a phone number on file.** This
matches the AC's own example wording ("opted in to SMS/WhatsApp **or
email-only**" — implying email is the always-available baseline) and
ordinary transactional-email norms (order confirmations aren't typically
subject to marketing opt-out). A guest order (`Order.guestEmail`, no
`User` row) still gets its confirmation email — there's no preference to
consult and no marketing-consent concern for a one-time transactional
receipt — but can never receive SMS/WhatsApp: there is no mechanism to
collect consent or a phone number during guest checkout, a deliberate
scope boundary, not an oversight. `resolveChannelTargets` always returns
a target for all three channels (recipient `null` when ineligible)
rather than omitting ineligible channels outright, so a `SkippedNoConsent`
row is written explaining why — satisfying the AC's explicit third
status value and the "can a support agent look this up" requirement,
rather than leaving silence where an answer should be. `NotificationPreference`
is a new one-per-user satellite table (`phone`, `emailOptIn` default
`true`, `smsOptIn`/`whatsappOptIn` default `false`), mirroring how
`RewardAccount`/`ReferralCode` are satellite tables rather than `User`
columns.

**5. Message copy is a `NotificationTemplate` row, not a hardcoded
string — seeded with real, working (if plain) copy for all 6 types × 3
channels (18 rows), not left as an unusable abstract contract.** No
admin template-management system exists yet (Section 7's future
capability). Per CLAUDE.md's own Admin Console Principle ("could a
non-technical admin change this later without redeploying?"), template
content belongs in the DB from day one — exactly the content STORY-054's
future authoring UI will edit, the same "build the real thing before the
admin story exists" pattern STORY-027/029/030/031 already established.
`renderTemplate` is a plain `{{key}}` substitution — no templating engine
needed for this story's scope.

**Variable contract** (per the AC's explicit "documented" requirement):

| Notification type | Trigger source | Variables |
|---|---|---|
| `order.confirmed` | `order.service.ts::createOrder` → `order.confirmed` event | `orderNumber`, `grandTotal`, `currency` |
| `order.dispatched` | `order.service.ts::transitionOrderStatus` (`to: "Dispatched"`) → `order.dispatched` event | `orderNumber`, `grandTotal`, `currency` |
| `order.delivered` | `order.service.ts::transitionOrderStatus` (`to: "Delivered"`) → `order.delivered` event | `orderNumber`, `grandTotal`, `currency` |
| `order.cancelled` | `order.service.ts::cancelOrder` → `order.cancelled` event | `orderNumber`, `grandTotal`, `currency` |
| `rewards.points_earned` | `rewards.service.ts::creditPointsForConfirmedOrder` (direct call, success path only) | `points` |
| `referral.qualified` | `referral.service.ts::handleQualifyingCheck` (direct call, success path only) | `points` |

**6. No retry infrastructure — fire-and-forget with a durable log row,
matching this codebase's own existing precedent.** Confirmed during
planning: no cron, no job runner, no generic retry mechanism exists
anywhere in `src/`, and `OrderIntegrationEvent` itself (the closest
precedent) is write-then-best-effort-call, never re-polled. `NotificationLog`
follows the same shape deliberately — a failed send is fully visible
(status `Failed`, `error` populated) for a future admin/ops view to act
on, but this story does not add a poller. `sendNotification` never
throws outward (mirrors `referral.service.ts::attributeReferralAtRegistration`'s
"best-effort side effect" pattern) — for order-lifecycle notifications
this sits inside `emitOrderEvent`'s own per-consumer try/catch; for the
two direct-call triggers, `sendNotification`'s internal per-channel
try/catch in its own for-loop is the only guard needed, since it's a
plain function call, not a second consumer registration.

**Testing:** `notification-service.test.ts` — template rendering with
real substitution, a guest order-confirmation email with no `User`/
preference row involved, consent gating (opted-out/no-contact →
`SkippedNoConsent`, no provider call; email's default-on behavior even
with zero preference row), the duplicate-send guard (including the
cross-channel placeholder-collision scenario the schema fix above
addresses), provider-failure and missing/inactive-template paths logged
as `Failed` without throwing. `EmailProvider` is mocked via `vi.hoisted`
in every unit/DB-integration test that touches it (rewards-service,
referral-service, notification-service test files) so none of them
depend on network availability — `order-notifications.spec.ts` is the
sole test that deliberately exercises the real Ethereal-backed adapter,
in the e2e suite where a real browser and a running dev server are
already required. `order-service.test.ts` gained one test proving
`transitionOrderStatus` now emits `order.dispatched`/`order.delivered`
exactly once each. `rewards-service.test.ts`/`referral-service.test.ts`
each gained one focused test proving a notification lands on a genuine
credit/qualification and never a second time for a replay.
`notification-routes.test.ts` — the preferences GET/POST auth/validation/
merge-semantics paths.

## 2026-09-29 — STORY-033 Customer Dashboard (auth, session guard, dashboard)

**Scope.** Registration/login (`/api/auth/register`, `src/lib/auth.ts`)
already existed as STORY-031's prerequisite, deliberately bare ("no email
verification, no password reset" per that route's own doc comment). This
story adds the missing pieces: forgot/reset-password, a durable
`/account/*` auth guard (nothing existed before this — the wishlist page
had no guard at all), and the `/account` dashboard landing page. Order,
reward, and wishlist business logic are NOT owned here —
`customer-dashboard.service.ts` only composes `order.service.ts`'s
`listOrdersForUser`, `rewards.service.ts`'s `getBalanceForUser`, and
`wishlist.service.ts`'s `getWishlist` into summary shapes.

**Session invalidation on password reset, under a stateless (Credentials)
JWT strategy.** The AC requires old sessions to stop working after a
reset. Auth.js v5's Credentials provider forces `session.strategy: "jwt"`
(no DB session row to delete), so "invalidate" has to mean "the JWT no
longer verifies." `User.passwordChangedAt` is the mechanism: its
millisecond timestamp ("password version") is embedded in the JWT at
sign-in (`token.pwv`, via the `user` object `authorize()`/
`auth.service.ts::verifyCredentials` returns) and re-checked against the
DB on every subsequent token refresh (`src/lib/auth.ts`'s `jwt` callback,
the `else` branch where `user` is absent). A mismatch throws inside the
callback — confirmed by reading `node_modules/@auth/core/lib/actions/session.js`:
the `session()` action's `try/catch` around `callbacks.jwt` treats a
thrown error as "clear the session cookie, return a null body," which is
exactly how `auth()` (server) and `useSession()` (client) both observe an
invalidated session going forward. `auth.service.ts::resetPassword` bumps
`passwordChangedAt` via `user.repository.ts::updatePassword`, which is
what actually triggers the mismatch on the customer's other tabs/devices.
`tests/e2e/helpers/auth.ts`'s `signInAs` (used by every prior story's e2e
suite) was updated to embed a matching `pwv` claim — reading the user's
real `passwordChangedAt` at cookie-mint time — so this change doesn't
silently break every existing e2e test that signs in via a hand-crafted
cookie.

**Reset tokens reuse Auth.js's `VerificationToken` model, hashed at
rest.** No new table — `VerificationToken` (`identifier`/`token`/
`expires`) has existed unused since STORY-001's Prisma adapter setup and
is exactly the shape a reset token needs. `password-reset.repository.ts`
stores a SHA-256 hash of the mailed token (never the raw value) in the
`token` column, matching how `passwordHash` itself is never stored raw —
a DB read alone can never yield a usable token. `requestPasswordReset`
always resolves the same way (200, generic body) whether or not the
email is registered, and deletes any of the identifier's outstanding
tokens before issuing a new one and again on a successful reset, so an
old, unused link can never be replayed after a newer request or a
completed reset.

**Reset emails use STORY-032's real notification service, not a stub.**
The story text allowed stubbing this ("per STORY-001's auth scaffold"),
but STORY-032 shipped a working, provider-agnostic email adapter in the
interim, so stubbing would be regressive. `sendNotification` itself
doesn't fit, though: it's gated by `NotificationPreference.emailOptIn`
(wrong for a security-critical, always-must-send email) and keys its
duplicate-send guard on a `triggeringEventId` that must be an
Order/RewardTransaction/ReferralAttribution id — a password reset has
none of those. `notification.service.ts::sendTransactionalEmail` is a
new, narrow export that reuses the file's own cached
`getProviderForChannel("Email")` (so it doesn't spin up a second Ethereal
sandbox account) while bypassing the opt-in/template/log machinery
entirely — each reset token is already single-use and unique, so no
separate dedup layer is needed.

**The auth guard lives in `src/proxy.ts`, not a shared `/account/layout.tsx`
alone — Next 16 renamed `middleware.ts` to `proxy.ts`, and only one is
allowed per project.** STORY-031's referral-attribution proxy already
occupied that file; this story's guard was added alongside it rather than
creating a second file, which Next 16 doesn't support
(`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`
confirms the rename and the one-file limit). The guard only runs `auth()`
for `/account/*` paths (excluding the public auth pages and `/account/
wishlist`, which STORY-013 deliberately supports for guests too via a
client-side Zustand store) — it does not touch every page the way the
referral logic does, preserving that code's original "this proxy never
touches the DB" property for the ~everything-else case. Per Next's own
authentication guide's "optimistic vs. secure checks" distinction
(`.../02-guides/authentication.md`), this is the optimistic layer:
correct callbackUrl on the common case (a direct/bookmarked hit on a
protected page while logged out), cheap because it usually runs with no
session cookie at all (the `session()` action short-circuits before
`callbacks.jwt` even runs). `(storefront)/account/(dashboard)/layout.tsx`
is the secure layer — same `auth()` call, redirects without a
callbackUrl — needed because the same guide warns a shared layout
doesn't re-render on sibling client-side navigation, so it can't be the
*only* check; each guarded page fetching its own data via `auth()` (as
the dashboard page does) is what actually closes that gap on navigation
within the section.

**Two sibling route groups under `/account/`, not one shared layout.**
`(public)/` holds `login`, `register`, `forgot-password`, `reset-password`
(login/register moved here unchanged — same URLs, `git mv` only);
`(dashboard)/` holds the guard `layout.tsx` and the new dashboard
`page.tsx`. Route groups are URL-transparent and Next explicitly
documents "opting specific route segments into sharing a layout, while
keeping others out" as a supported use case
(`node_modules/next/dist/docs/.../route-groups.md`) — a single
`account/layout.tsx` would have wrapped the public auth pages too,
redirect-looping an unauthenticated visitor on `/account/login` itself.
`account/wishlist/page.tsx` stays a direct sibling of both groups,
untouched — it's intentionally usable while logged out.

**Dashboard widgets stream independently, per the AC.** Each widget
(`RecentOrdersCard`, `RewardsSummaryCard`, `SavedItemsCard`) is its own
`async` Server Component awaited inside its own `<Suspense>` boundary on
the dashboard page — not one aggregating function `Promise.all`'d and
awaited once, which would tie every widget's paint to the slowest one.
`QuickLinksCard` has no data fetch, so it renders immediately without a
boundary of its own.

**No new migration file — `db push` only, matching every story since
STORY-025.** Tried to produce one per the documented STORY-001 recovery
procedure (wipe `%LOCALAPPDATA%\prisma-dev-nodejs\Data` entirely, restart
`prisma dev`, pre-seed `_prisma_migrations`, run `migrate dev` as that
server session's first call) — it still fails applying the very first
migration (`P3018`/`42710`, `type "ContentStatus" already exists`) on a
database that was, moments earlier, provably empty. `git log -- prisma/
migrations` confirms no migration has been committed since STORY-025's
`20260928050000_add_checkout_orders`, despite STORY-026 through STORY-032
each adding real schema (payments, shipping, orders, coupons, rewards,
referrals, notifications) — this is an ongoing, unresolved instance of
the same upstream PGlite bug, not something specific to this story's
change, and every story in that range has evidently already been living
with it via `db push` alone. `schema.prisma`'s `passwordChangedAt`/
`marketingOptIn` additions are applied and verified via `db push`; a real
migration for the accumulated STORY-026→033 drift is a separate cleanup,
out of this story's scope.

**Rate limiting is in-memory, single-process — no Redis/queue exists in
this stack yet.** `src/lib/rate-limit.ts`'s fixed-window counter is
applied to login attempts (keyed by email, in
`auth.service.ts::verifyCredentials`) and reset requests (keyed by
email, in `requestPasswordReset`). Documented as a known limitation:
this resets on every process restart and won't coordinate across
instances — fine for the current single-instance deployment, revisit
with a shared store before running more than one.

**Testing:** `auth-service.test.ts` — registration (including the
duplicate-email rejection), credential verification (wrong password,
unknown email, and rate-limiting all return the same `null`, so the
route/provider can't leak which one occurred), and the full
request-reset → reset → old-token-rejected → new-session-required
lifecycle. `tests/e2e/account-dashboard.spec.ts` — register → land on
`/account` → see the dashboard's empty states → sign out → confirm
`/account` redirects to `/account/login?callbackUrl=%2Faccount` while
signed out.

## 2026-09-29 — STORY-034 Profile, Addresses & Account Settings

**Scope.** `/account/profile`, `/account/addresses`, `/account/security`,
`/account/notifications` nested under STORY-033's guarded `(dashboard)`
route group, plus `/account/profile/verify-email` in the public group
(email-change confirmation, opened possibly unauthenticated). Extends,
rather than recreates, two models that already existed in minimal form:
`Address` (STORY-025, checkout-only) and `NotificationPreference`
(STORY-032, a single blanket `emailOptIn`) — both confirmed via reading
the actual schema before writing a line of code, since the story's own
task list described them as if new.

**`Address`: default-billing/default-shipping split, not a second
"isDefault" column.** The pre-existing model had one `isDefault` boolean.
STORY-034 needs independent defaults per the AC ("customer can
independently set a default billing address and a default shipping
address"), so `isDefault` became `isDefaultBilling` + `isDefaultShipping`
(migration; `db push`, no new migration file — see below). `country`,
`label` (`AddressLabel` enum), `type` (`AddressType` enum),
`companyName`, `taxId` are new columns. `address.repository.ts` is now
pure CRUD (list/count/create/update/delete/clearDefaultBilling/
clearDefaultShipping/setDefaultBilling/setDefaultShipping); the
default-swap invariant (exactly one default of each kind, atomically) and
the 10-address cap live in the new `address.service.ts`, inside a
`prisma.$transaction`. `checkout.service.ts` (STORY-025) no longer calls
the repository directly — it calls `address.service.ts`'s
`saveAddressFromCheckout`/`listAddresses` wrappers, so the business rules
aren't duplicated between checkout's save-during-checkout flow and the
new account address book. A checkout customer who already has 10 saved
addresses can still place the order — the save is best-effort, catching
`AddressLimitExceededError` specifically (mirrors this codebase's other
"never block the primary action on a saved-address side effect"
precedent).

**The AC's "deleting an address referenced by a pending/in-progress order
is blocked" guard is not implemented — confirmed inapplicable, not
skipped.** `Order` stores an immutable, flattened `ship*` snapshot taken
at placement time (`shipRecipientName`, `shipLine1`, etc.) — there is no
foreign key from `Order` to `Address` at all (confirmed by reading
`prisma/schema.prisma` and `order.repository.ts` before deciding this).
Deleting a saved address can never affect an existing order's record,
because nothing references it. Implementing a guard against a
relationship that doesn't exist would be dead code.

**"Promotional emails" is `User.marketingOptIn`, not a new
`NotificationPreference` field.** STORY-033's registration checkbox
already captures this exact concept. The AC's toggle list (order-update
emails / promotional emails / SMS / WhatsApp / reward-referral updates)
maps to: `NotificationPreference.emailOptIn` (kept its original STORY-032
name — it already means "order-lifecycle email," the only category this
app sent before this story; renaming it would be a needless migration),
a new `NotificationPreference.rewardUpdatesOptIn`, `smsOptIn`/
`whatsappOptIn` (unchanged), and `User.marketingOptIn` (reused). The
settings page's single form PATCHes both models in one request;
`/api/notifications/preferences`'s route handler is what splits
`marketingOptIn` out to `profile.service.ts::updateProfile` from the rest
of the payload, which goes to `notification.service.ts`'s existing
preference upsert. `notification.service.ts::resolveChannelTargets` now
picks `emailOptIn` vs `rewardUpdatesOptIn` by the `templateKey` prefix
(`"order."` vs `"rewards."`/`"referral."`) — the only signal available,
since `sendNotification`'s callers (the order-event consumer,
`rewards.service.ts`, `referral.service.ts`) don't otherwise pass a
category.

**Profile photo is a URL string — no upload infrastructure exists
anywhere in this app, confirmed by searching the whole codebase.** Every
other image field (`ProductImage.url`, `BlogPost.heroImageUrl`, etc.) is
already a plain URL entered directly; `ReviewImage`'s own doc comment
calls this out as a deliberately deferred STORY (a storage provider isn't
chosen yet — `docs/blueprint.md` Section 10). Rather than guess a
provider, the profile photo field reuses the pattern: a URL, stored in
`User.image` (the Auth.js-standard field, already flowing into the
session via `auth.service.ts`'s `AuthenticatedUser.image` since
STORY-033 — no new column). Real upload is future scope once a provider
is chosen. Confirmed with the user before implementing (not guessed).

**Session revocation is global-only ("this session too"), not
per-device — confirmed with the user before implementing.** Sessions are
JWT-only with no per-session identifier or DB-backed session table
(STORY-033's `passwordChangedAt`/`pwv` mechanism invalidates *every*
session at once, including the one making the request — there's no way
to distinguish "this device" from "other devices" without adding a
session-id claim and a new sessions table, which is real new
architecture, not an extension). Both "change password" AND "log out of
all devices" reuse that same mechanism:
`security.service.ts::changePassword` calls
`user.repository.ts::updatePassword` (already bumps `passwordChangedAt`);
`logOutAllDevices` calls a new `bumpSessionVersion` that does the same
bump without touching the hash. Both the change-password form and the
logout-all-devices button sign the browser out and redirect to login
immediately after, since the current session is invalidated too.

**Email-change verification reuses password-reset.repository.ts's
`VerificationToken` wrapper, with a prefixed identifier to avoid
cross-flow collisions.** `VerificationToken.identifier` was, until now,
always a user's email (password reset). Email-change tokens use
`email-verify:${userId}` as the identifier instead of the email itself —
first, because the email being verified is the *new*, not-yet-active one
(the old email is still what the user might reset their password with
concurrently), and second, because `deleteAllForIdentifier` is
scoped to one identifier: a same-user password-reset request and an
email-change request in flight at the same time would otherwise delete
each other's token the moment either flow's `create()` call runs.
`User.pendingEmail` holds the new address from request time; `email`
itself, and `emailVerified`, only change once `confirmEmailChange`
verifies the mailed link — matching the AC ("changing email requires
re-verification before the new email becomes active"). Confirmed via
`tests/unit/profile-service.test.ts`'s "a concurrent password-reset
request... does not invalidate the email-verify token" case.

**Account deactivation is a request, not an enforced state.** `POST
/api/account/deactivate` flips `User.status` to `DeactivationRequested`
and records the reason — it does not sign the customer out, block future
logins, or delete anything. The AC asks for a request flow ("soft-delete
flag on User, not a hard delete"); actually enforcing deactivation
(blocking login, hiding the account) reads as a staff/admin action this
story doesn't own — the `Deactivated` status value exists in the
`AccountStatus` enum for that future use, unused by any code today.

**Toasts use `@base-ui/react`'s own `Toast` module, not a new
dependency.** The AC wants a success toast with no full-page reload on
every settings save. `@base-ui/react` (already a dependency — every other
`src/components/ui/*.tsx` wraps it) ships a complete, unstyled Toast
primitive (`Provider`/`Portal`/`Viewport`/`Root`/`Title`/`Description`/
`Close`, plus a framework-level `createToastManager()` singleton),
confirmed by checking `node_modules/@base-ui/react/toast/` before adding
anything — no need for `sonner` or another library. `src/lib/toast.ts`
exports the one global manager; `src/components/ui/toast.tsx` wraps the
primitive parts in this codebase's usual `data-slot` + `cn()` style;
`<Toaster />` is mounted once in `src/app/providers.tsx`. Any client
component calls `toastManager.add({ title, description })` directly —
no hook or context needed at the call site.

**No new migration file — same `db push`-only situation as STORY-033.**
Re-attempted the documented recovery (wipe
`%LOCALAPPDATA%\prisma-dev-nodejs\Data` entirely, restart `prisma dev`,
pre-seed `_prisma_migrations`, run `migrate dev` as that session's first
call) — it still fails applying the very first migration (`P3018`/
`42710`) against a database that was, moments earlier, provably empty.
Unresolved upstream PGlite bug, not specific to this story's schema
change. `schema.prisma`'s STORY-034 additions are applied and verified
via `db push`.

**Testing:** `address-service.test.ts` — first-address-becomes-both-
defaults, a second address does not auto-default, the default-billing/
default-shipping swap (atomically un-defaults the previous holder,
independently per kind), the 10-address cap, ownership checks on
update/delete/set-default. `profile-service.test.ts` — profile field
updates, the full email-change lifecycle (request → pendingEmail set,
email untouched → confirm → email swapped, pendingEmail cleared →
duplicate-email rejection → invalid-token rejection → the
concurrent-password-reset non-collision case). `security-service.test.ts`
— password change invalidates the old password and bumps the session
version; an incorrect current password changes nothing;
`logOutAllDevices` bumps the session version without touching the hash.
`tests/e2e/account-settings.spec.ts` — add/edit/set-default/delete an
address through the real UI, and a full change-password →
forced-sign-out → old-password-rejected → new-password-accepted round
trip.

## 2026-09-29 — STORY-035 Reward Wallet & Referral Dashboard

**Presentation-only, confirmed by reading both engines in full before
writing anything.** `/account/rewards` and `/account/referrals` read
STORY-030's `rewards.service.ts` and STORY-031's `referral.service.ts` —
no point-earning, tier-threshold, expiry, or referral-crediting rule is
defined here. **Zero schema changes** — this story added no migration
and no `db push` either. Future changes to point values, tier
thresholds, expiry windows, or referral payout amounts belong in
STORY-030/031, not here.

**No standalone (cart-independent) redemption exists — the redemption
dialog is a preview, not a mutation. Confirmed with the user before
building.** Every redemption path in `rewards.service.ts`
(`applyPointsToCart`, `validateRedemptionAtPlaceOrder`, etc.) requires an
active `Cart` row; there is no "redeem points for store credit/a
voucher" mechanism anywhere in this app, and building one would be new
STORY-030-owned business logic, not presentation. `RedeemPointsDialog`
instead calls `rewards-calc.ts::calculatePointsRedemption` — the same
pure, DB-free calculation checkout itself uses — directly from the
client, with `payableBeforePoints: Number.MAX_SAFE_INTEGER` so only the
balance and per-order-cap constraints bind (there's no real order to cap
against for a preview). The dialog tells the customer redemption
actually happens at checkout and links to `/products`. The task list's
suggested `POST /api/account/rewards/redeem` was dropped along with
this — there is nothing for it to call.

**"Available redemption options" is a rate + cap, not a catalog.**
`RewardSetting` has no table of named redemption tiers ("Rs 500 off")
— confirmed by reading the model — only `pointsToCurrencyRate` and
`maxRedeemablePointsPerOrder`. The AC's "view available redemption
options" is interpreted as seeing that rate/cap against the customer's
own balance (the preview dialog above), not choosing from a list.

**Reused STORY-030/031's existing API routes directly** —
`/api/rewards/balance`, `/api/referral/code`, `/api/referral/status` —
rather than building `/api/account/rewards/summary` /
`/api/account/referrals/summary` as the task list suggested. Each
already carried a doc comment anticipating this
("consumed by STORY-035's future ... dashboard"), the same pattern
STORY-034 already followed for STORY-032's `/api/notifications/
preferences`. One genuinely new route was needed:
**`GET /api/account/rewards/history`** — STORY-030's own
`/api/rewards/transactions` has no running-balance column (the AC wants
one), and extending that response would mean changing a contract
STORY-030 owns for a STORY-035-only need. `POST /api/account/referrals/
link` (regenerate the code) was dropped entirely — no
regenerate/rotate-code function exists in `referral.service.ts`
(`ReferralCode.userId` is `@unique`; `getOrCreateReferralCode` never
overwrites), and adding one would be new STORY-031-owned capability.

**Running balance is computed in memory, not with a raw-SQL window
function.** `RewardTransaction` stores only a signed `points` delta per
row, no `balanceAfter` column. `rewards.repository.ts::
listAllTransactionsAscending` (new) fetches a customer's entire ledger
ordered oldest-first; `customer-rewards-dashboard.service.ts::
getPointHistoryPage` accumulates a running sum, reverses to newest-first,
and paginates the resulting array in memory. This app already uses
`$queryRaw` elsewhere (`recipe-review.repository.ts`,
`review.repository.ts`, `search.repository.ts`), so a window-function
query was a real option, but a personal reward ledger is bounded by one
customer's own activity — realistically hundreds of rows, not millions —
so the simpler, dependency-free approach was preferred. Documented here
as a scale assumption specific to this one read path, not a pattern to
copy for a shared/larger table.

**"Points expiring soon" needed one new, purely additive repository
query** — nothing existing surfaced this.
`rewards.repository.ts::findUpcomingUnclosedEarnedBatches` mirrors the
existing `findExpiredUnclosedEarnedBatches` (STORY-030's own expiry
sweep) exactly, just with a future date window instead of a past one —
same filter shape (`type: "Earned"`, `expiredBy: null`), no new rule
about what counts as expiring. The banner's total is capped at the
customer's current spendable balance, mirroring the sweep's own
conservative cap, since points aren't tracked FIFO-per-batch against
spend.

**"Total referral rewards earned" sums `ReferralBonus` minus
`ReferralBonusReversed` for the viewing user AS REFERRER — not
`ReferralWelcomeBonus`, which is a different fact (what this user
received for being referred by someone else).** Needed a new
`rewards.repository.ts::sumPointsByTypes` (a small, generic, additive
`groupBy` aggregator, same shape as the existing `getBalances`) — lives
in `rewards.repository.ts`, not `referral.repository.ts`, since the
points themselves are `RewardTransaction` rows, not a field on
`ReferralAttribution`.

**The referred-friends list shows two states, not the AC's four.**
`ReferralAttributionStatus` only has `Registered`/`Qualified`/`Excluded`
— qualification and the bonus credit happen atomically together
(`referral.service.ts::handleQualifyingCheck`), so there is no
"first purchase completed but reward not yet earned" state distinct
from "reward earned" in the data model. Mapped as: Registered → "Signed
Up", Qualified → "Reward Earned". "Invited" (a link sent but not yet
acted on) has no row at all — nothing to list. `Excluded` (self-referral)
attributions are filtered out of the customer-facing list entirely
rather than shown with an explanation, since it never happened as far as
the customer should see.

**Testing:** `customer-rewards-dashboard-service.test.ts` — the pure
`computeTierProgress` function (mid-tier progress, top-tier/no-next-tier,
below-every-threshold, and no-tiers-configured cases), the running-balance
computation and its pagination, and the expiring-soon window (capped at
balance, empty when nothing qualifies, and the no-expiry-configured
case). `customer-referrals-dashboard-service.test.ts` — the
Registered/Qualified → Signed Up/Reward Earned mapping, Excluded
filtering, email masking, the generic-name fallback, and the
ReferralBonus-minus-ReferralBonusReversed total excluding
ReferralWelcomeBonus. `tests/e2e/rewards-referrals-dashboard.spec.ts` —
both pages' empty states, balance + point history + the redemption
preview dialog's live calculation, and the referral link's copy-to-
clipboard action with a referred friend's status visible.

## 2026-09-29 — STORY-036 Order History & Support

Customer-facing order list/detail/reorder/return-request/support-ticket
system, nested under STORY-033's `/account` shell and built entirely on
STORY-028's Order Management engine. Several places where the story's own
task list was stale or contradicted established convention were resolved
before writing anything, matching the precedent STORY-028 and STORY-035
both set for their own docs:

**The real `OrderStatus` enum, not the AC's wording.** The AC lists
`Pending/Processing/Dispatched/Delivered/Returned/Cancelled`; the actual
enum (`prisma/schema.prisma`) is `PendingConfirmation | Confirmed |
Processing | Dispatched | Delivered | Cancelled | Returned`. The status
filter (`order.schema.ts::orderStatusFilterSchema`, `OrderFilterBar`) uses
the real seven values.

**Route param is `orderNumber`, not `id`.** STORY-028's own entry already
flagged the codebase-wide convention; this story's new routes
(`/api/orders/[orderNumber]/reorder`, `.../return-request`,
`.../invoice`) and page (`/account/orders/[orderNumber]`) follow it, not
the task list's `[id]` wording.

**`src/validation/` stayed flat.** No `account/` subfolder exists
anywhere in that directory; `return-request.schema.ts` and
`support-ticket.schema.ts` sit alongside every other domain's schema
file, not in a new subfolder the task list implied.

**`GET /api/orders` was extended in place, not duplicated as
`/api/account/orders`.** Nothing outside this story's own tests consumed
its previous response shape (verified by grepping the codebase), so
adding optional `status`/`dateFrom`/`dateTo` query params and switching
its backing call to this story's `getOrderListPage` (thumbnails +
filters) was a safe, additive change — the existing
`order-routes.test.ts` assertions on `orders`/`total`/`page` still pass
unchanged. `GET /api/orders/[orderNumber]` (STORY-028) was left as-is;
the order-detail *page* calls `customer-order-history.service.ts::
getOrderDetail` directly (Server Components call services, not their own
JSON routes) rather than extending that route's `OrderConfirmationSummary`
contract, which the checkout confirmation page also depends on unchanged.

**`OrderStatusTimeline` (`src/components/storefront/orders/
order-status-timeline.tsx`) is reused unmodified**, exactly as STORY-028's
own doc comment on it anticipated — not rebuilt, despite the task list
asking for a new one.

**No `TicketMessage` reply-thread model.** Confirmed with the user before
building: no acceptance criterion requires viewing or sending replies
(admin-side ticket moderation is explicitly out of scope for this story,
and no admin console exists yet to reply from), so `SupportTicket` stores
the initial message + status only. A future admin console (STORY-047)
can add threading without migrating this story's data.

**Fixed a dangling `/support` nav link.** `account-nav.tsx` and
STORY-033's `quick-links-card.tsx` both already linked to `/support`,
which existed nowhere in the app (confirmed — zero matches for that
route). Both now point at `/account/support`.

**Tracking (`carrier`/`trackingNumber`/`trackingUrl`) and a payment
summary didn't exist on `Order` before this story** — both are additive,
nullable fields/reads this story owns jointly with STORY-028, per that
story's own hedge that a not-yet-built piece of the Order model becomes a
joint extension rather than a competing table. Nothing writes tracking
fields yet (STORY-047's admin console will); the detail page shows "not
yet available" when null. `order.repository.ts::
findOrderByNumberWithPayment` is a new, additive sibling of
`findOrderByNumber` (adds a `payment` include) so STORY-028's existing
callers keep their exact return shape.

**Reorder has no existing bulk-add-to-cart primitive to call.**
`cart.service.ts::addItem` only ever added one product at a time; the
closest precedent, `mergeGuestCartIntoUser`, is guest-cart-specific and
silent about what it drops. `customer-order-history.service.ts::
filterReorderableItems` is a new **pure** function (unit-tested without a
database) that gates on the same three fields cart.service.ts's own
`requireAvailableProduct`/`mergeGuestCartIntoUser` already use
(`status === "Published"`, `inStock`, `stockQuantity`), so "still
purchasable" can't drift into a second definition; its async wrapper,
`reorderPastOrder`, then calls the existing `cart.repository.ts::
upsertCartItem`/`updateCartItemQuantity` primitives per line, mirroring
`mergeGuestCartIntoUser`'s own combined-quantity-capped-at-stock math.
Skipped items are reported back to the caller (`{productName, reason}`)
rather than silently dropped, since (unlike a guest-cart merge) the
customer is actively watching this action.

**A return request only allows a `Delivered` order** (AC), enforced in
`createReturnRequest` via a new `OrderReturnNotAllowedError` (added to
`order.errors.ts`'s existing `OrderServiceError` family, since this is
fundamentally an order-ownership-and-state operation, not a separate
error hierarchy). Requested quantities are validated against the order's
own snapshot lines (`InvalidReturnQuantityError`) — a return can never
claim more of an item than was actually ordered. `ReturnRequest.items` is
a JSON snapshot (`{orderItemId, productName, quantity}`), mirroring
`OrderItem`'s own point-in-time-snapshot convention rather than a live
join.

**No invoice/packing-slip PDF generation existed anywhere in the
codebase before this route** (confirmed by grepping `src/` for
"invoice"/"packing" — zero hits outside docs' own forward-references to
this story). `invoice-pdf.service.tsx` is a new file built on the same
`@react-pdf/renderer` + `@fontsource` + brand-color pattern as
`recipe-pdf.service.tsx` (the only precedent for PDF generation in this
app) — same font-registration approach, `.tsx` extension requirement
(the file contains JSX), `renderToBuffer` return.

**`ReturnRequestStatus` lifecycle** (for STORY-047's future admin
console): `Requested` (customer submitted, this story's only writer) →
`Approved` / `Rejected` (admin decision, not built here) → `Completed`
(refund/exchange processed, not built here). **`SupportTicketStatus`
lifecycle**: `Open` (default, this story's only writer) → `InProgress` →
`Resolved` / `Closed` (all three are admin-side transitions, not built
here).

**Testing:** `customer-order-history-service.test.ts` — the pure
`filterReorderableItems` function (in-stock, deleted-product,
unpublished-product, zero-stock, and partial-stock-cap cases) and
`getOrderListPage`'s status filter and thumbnail lookup.
`support-ticket-service.test.ts` — ticket creation with and without an
order reference, an ownership check rejecting another customer's order
number, and paginated listing. `tests/e2e/order-history-support.spec.ts`
— empty states, order detail with status timeline and tracking, a
reorder, a return-request submission on a delivered order, and a
support-ticket submission both with and without an order pre-fill.

## 2026-09-29 — STORY-037 Saved Recipes & Sync

Customer-facing `/account/saved-recipes` list/unsave page, built entirely
on STORY-022's existing bookmark engine (`recipe-bookmark.service.ts`,
`RecipeBookmark`). Per that story's own doc comment ("the one method
STORY-037 is expected to call/reuse rather than reimplement"), this story
touches no bookmark data model, toggle mechanism, or save/unsave rule.

**No new API routes, and no new validation schema — deliberately, not an
oversight.** The story's own task list proposed `GET /api/account/
saved-recipes` and `DELETE /api/account/saved-recipes/[recipeId]`, but
STORY-022 already built everything this page needs, and building a
second, differently-shaped route/response would have created a *second*
cache entry that the corner-icon bookmark toggle used everywhere else on
the site (`RecipeBookmarkButton` → `useRecipeBookmark` →
TanStack Query key `["recipe-bookmarks"]`, hitting `GET /api/recipes/
bookmarks` and `POST`/`DELETE /api/recipes/[slug]/bookmark`) would know
nothing about — the opposite of the AC's "single source of truth, no
locally-diverging state." Instead:

- The page's Server Component calls `customer-saved-recipes.service.ts::
  getSavedRecipesForCustomer`, a one-line wrapper over `recipe-bookmark.
  service.ts::listBookmarksForCustomer`, and passes the result as
  `initialData` into a Client Component (`saved-recipes-view.tsx`) that
  reads the *same* `["recipe-bookmarks"]` query key `RecipeBookmarkButton`
  writes to. Dropping the existing `<RecipeCard recipe={r} />` (via the
  existing `RecipeGrid`) into this page's grid gets "remove a bookmark
  directly from this list, reflected immediately everywhere else" for
  free — its built-in corner bookmark button already toggles the exact
  shared cache entry. No bespoke unsave route, handler, or button was
  written for this story.
- Filtering/sorting/pagination are done client-side over the
  already-fetched array (a personal bookmark list — bounded by one
  customer's own activity, same "realistically hundreds of rows, not
  millions" reasoning STORY-035 documented for reward-point history, not
  a pattern to copy for a shared/larger table). A "Show more" button
  reveals more of the filtered array client-side rather than a real
  pagination API, satisfying the AC's explicit "(or infinite-scroll)"
  allowance.
- No request/query params cross a trust boundary (there's no new route),
  so no new Zod schema was needed — the story's task-list-suggested
  `src/validation/account/saved-recipes-query.schema.ts` was dropped
  entirely, not merely relocated (also: `src/validation/` has no
  `account/` subfolder anywhere in this codebase, same finding STORY-036
  already made).

**`SavedRecipesSort` is a new, small type (`dateSaved | alphabetical`),
not a reuse of the domain's `RecipeSort`.** `recipeSortValues`
(`newest/popular/rating/time`, `buildRecipeOrderBy` in
`recipe.repository.ts`) sorts by `publishedAt`/`viewCount`/`avgRating`/
`totalTimeMinutes` — none of which is "date bookmarked" or "title A–Z,"
which is what this story's AC asks for. `dateSaved` is simply the input
array's own order (`listBookmarksForCustomer` already returns
most-recently-bookmarked-first); `alphabetical` sorts by
`title.localeCompare`. Both live in a new, pure, unit-tested function,
`src/lib/saved-recipes-filter.ts::filterAndSortSavedRecipes` — deliberately
its **own file**, not part of `customer-saved-recipes.service.ts`: that
service file's other export (`getSavedRecipesForCustomer`) transitively
imports Prisma/`pg` via `recipe-bookmark.service.ts` →
`recipe-bookmark.repository.ts` → `lib/db.ts`. The saved-recipes page's
Client Component needs the pure filter function, and Next.js resolves a
file's imports as a unit at the client/server boundary (not per named
export) — importing anything from the service file from a Client
Component pulled the whole Prisma/`pg` module graph into the browser
bundle and failed to build (`Module not found: Can't resolve 'dns'`,
caught while running the e2e suite). Splitting the pure logic into its
own zero-server-import file fixed it.

**Category filtering matches on `RecipeCard.categoryName` (a string),
not a slug.** `RecipeCard` (the shared type in `types/recipe.ts`, reused
as-is) carries no `categorySlug` field. Filter options are the distinct
category names actually present in the customer's own saved list, not
the site-wide facet list (`listRecipeFacets()`), which would otherwise
show categories with zero results for this customer.

**`RecipeBookmark` gained one additive index, `@@index([customerId,
createdAt])`** — the story's own task list flagged the gap (only
`@@index([customerId])` existed); this is the first story to actually
need `createdAt`-ordered reads at any real cardinality, so it's added
here rather than by STORY-022 speculatively. No field or relation
changed.

**Dashboard widget count (`getSavedRecipesCountForDashboard`) was added
to STORY-033's existing `customer-dashboard.service.ts`, not to the new
full-page service file** — that file's own header comment scopes it to
"aggregation only... for the dashboard's summary widgets," exactly
mirroring the existing `getSavedItemsForDashboard`'s one-line "call the
owning domain service, derive count from `.length`" shape. This is
deliberately the *same* underlying call (`listBookmarksForCustomer`) the
full page uses, so the dashboard count and the page's own count can
never independently drift, per the AC.

**Testing:** `tests/unit/saved-recipes-filter.test.ts` — the pure
`filterAndSortSavedRecipes` function (empty input, dateSaved order
preserved, alphabetical sort, category filter, and both combined).
`tests/e2e/saved-recipes.spec.ts` — the empty state, a recipe bookmarked
on its detail page appearing on `/account/saved-recipes` and in the
dashboard's count, unsaving from the saved-recipes page syncing back to
both the page (now empty) and the detail page (shows unbookmarked again
after a fresh navigation, confirming real DB persistence rather than
only a client-cache effect), and the category filter.

## 2026-09-29 — STORY-038 Admin Auth & RBAC (core scope)

The security foundation for the whole Enterprise/Admin Platform epic —
every future admin story depends on a resolved admin session, role, and a
real server-side permission check. **This pass ships the core only**:
separate admin auth, the 12-role seed, the full permission matrix +
server-side enforcement, audit logging, and route guarding. Self-service
email invite, admin password reset, and TOTP 2FA are explicitly deferred
to follow-up work — confirmed with the user before starting — since
neither blocks any other admin story, which only needs a resolved role
and a working `hasPermission`/`requirePermission` check. The initial Super
Administrator is created by `prisma/seed-admin.ts`, not an invite flow.

**Fully separate from customer auth — cookie, secret, and session all
independent, not just cookie-name-different.** `src/lib/admin-auth.ts` is
a second, standalone NextAuth v5 instance: its own Credentials provider
(`admin-auth.service.ts::verifyAdminCredentials`, never touching `User`),
its own JWT claim (`aupv`, not the customer instance's `pwv` — both live
in the same global `next-auth/jwt` module augmentation since TypeScript
declaration merging is global, not per-instance, but the two values are
never cross-read since the instances use different secrets), its own
cookie names (`admin-authjs.session-token` etc., since Auth.js's default
`authjs.session-token` would otherwise silently collide with the customer
instance), and its own secret (`ADMIN_AUTH_SECRET`, not `AUTH_SECRET` —
real cryptographic separation). No `PrismaAdapter` on the admin instance:
Credentials + JWT sessions need none, and unlike the customer instance
(which keeps the adapter for a future OAuth provider), no OAuth admin
provider is planned, so wiring one up now would be speculative and risks
the adapter writing to the wrong tables (`User`/`Account`, not
`AdminUser`).

**`AdminUser` is a separate model from `User`, not a `role` field bolted
onto it** — `User`'s own header comment already said as much before this
story existed. Verified genuinely greenfield (no `Role`/`Permission`/
`AdminUser` anywhere, `(admin)/layout.tsx` an empty placeholder).

**A real bug, found only by running the e2e suite, not by type-checking:**
Auth.js defaults `basePath` to `/api/auth` (`next-auth/lib/env.js`) unless
told otherwise. Without an explicit `basePath: "/api/admin/auth"` on the
second instance, every request to `/api/admin/auth/*` failed with
`UnknownAction: Cannot parse action` — the instance silently assumed it
was mounted at the customer instance's path. `tsc`/lint had nothing to
say about this; only actually driving the real login form through
Playwright surfaced it.

**No `next-auth/react` client helpers for admin login/logout** — this
app has one global `SessionProvider` (`src/app/providers.tsx`), bound to
the customer instance's default `/api/auth` basePath, with no per-call
override exposed in this version. `admin-login-form.tsx`/
`admin-sign-out-button.tsx` instead replicate `next-auth/react`'s own
`signIn()`/`signOut()` request contract by hand (read directly from
`node_modules/next-auth/react.js`: fetch the CSRF token, POST to
`/api/admin/auth/callback/credentials` with `X-Auth-Return-Redirect: 1`),
pointed at the admin routes. This is also, incidentally, a stronger test
of the hand-rolled admin auth wiring than a cookie-injection test helper
(like the customer `signInAs` e2e helper) would have been.

**Lockout state is distinguished from a plain wrong password via
`CredentialsSignin`'s documented `code` mechanism** (`@auth/core/errors`),
not a raw thrown error (which Auth.js would collapse into a generic
`CallbackRouteError`, losing the distinction). A real behavior gap was
found and fixed during testing: the attempt that actually crosses the
lockout threshold originally just returned `null` (indistinguishable from
any other wrong password) even though it had just locked the account —
fixed to throw immediately on that attempt instead, so the admin is told
they're locked out right away rather than being confused by a
subsequently-still-failing "correct" password. Lockout itself is
DB-persisted (`AdminUser.failedLoginAttempts`/`lockedUntil`), not the
in-memory `src/lib/rate-limit.ts` limiter customer login uses — an admin
lockout must survive a process restart. Threshold (5 attempts) and window
(15 minutes) mirror `auth.service.ts`'s existing customer login rate
limit as the documented anchor, since blueprint.md specifies no concrete
number (see below).

**blueprint.md Section 7 gives the exact 12 role names and module
descriptions verbatim, but zero per-role permission detail and zero
concrete lockout/2FA numbers.** Its own closing section explicitly
disclaims this: "This file intentionally leaves out ... detailed
security/compliance chapters ... When a task needs that level of detail,
pull the relevant section from the source document rather than
guessing." The default permission matrix below and the lockout numbers
above are this story's own documented design choices, not blueprint
requirements — adjustable later via STORY-057's role-editing UI.
(Also: STORY-038's own "References" section citing "Section 8 enterprise
security standards" is stale — the actual current Section 8 is
"Development Governance & Coding Standards," unrelated; likely refers to
the original 291-page source PDF's own security chapter, not this file.)

**Permission model: `RolePermission(roleId, module, action)` is
sparse/existence-based**, not a dense true/false cell for every
module×action pair. A row's presence means granted; absence means denied.
Avoids seeding/storing ~1,440 explicit `false` rows (12 roles × 20
modules × 6 actions) while still satisfying the AC's "independently
configurable per module × action cell, stored in the database."
`permission.service.ts::hasPermission`/`requirePermission` always query
fresh from the DB — never trust anything cached in the JWT — so a
permission change (STORY-057, later) takes effect immediately without a
redeploy, per the AC.

**Default permission matrix** (`prisma/seed-admin.ts`): Super
Administrator gets all 6 actions (View/Edit/Delete/Approve/Export/Audit)
on all 20 modules — the AC's floor that can never be reduced.
Administrator gets every action except Audit on all 20 modules — Audit is
reserved to Super Administrator only, everywhere, a deliberate
simplification (viewing a module's audit trail is a cross-cutting,
higher-trust capability) avoiding a per-role judgment call blueprint.md
doesn't specify. Each of the other 10 functional roles gets
View/Edit/Delete/Approve/Export on 2-4 "home" modules matching its job
function and View-only everywhere else:

| Role | Home modules |
|---|---|
| Marketing Manager | Marketing, Homepage Builder, SEO |
| Sales Manager | Orders, Customers, Rewards & Referrals |
| Finance Manager | Orders, Export Portal, System Settings |
| Production Manager | Products, Media Library |
| Warehouse Manager | Orders, Delivery Zones, ERP Integration |
| Customer Support | Customers, Orders, Reviews, Q&A |
| Export Manager | Export Portal, Orders, CRM/Analytics |
| Content Editor | Blog, Recipes, Navigation, CMS Workflow |
| SEO Specialist | SEO, Navigation |

Viewer gets View-only on all 20 modules, nothing else. Verified by
direct seed inspection: Super Administrator = 120 rows (20×6),
Viewer = 20 rows (20×1), total 528 rows across all 12 roles — matches
the formula exactly.

**Two guards exist with no caller yet** — `assertCanModifyRolePermission`
(the Super-Administrator-floor: blocks removing any grant from that role)
and `assertNotLastSuperAdmin` (blocks deleting/de-elevating the last
active Super Administrator) — both unit-tested directly, since STORY-057
(the role-editing UI that will call them) doesn't exist yet. Per this
story's own framing: STORY-038 provides the primitives every later story
depends on, not just the parts with a UI already attached.

**`(admin)` route-group structure**: `src/app/(admin)/admin/page.tsx`
(protected, wrapped by `(admin)/layout.tsx`'s session guard) and
`src/app/admin/login/page.tsx` (public, deliberately a sibling outside
the group) both resolve under the same `/admin` URL prefix from two
different route-group parents — the same pattern the customer side
already uses (`account/(public)/login` + `account/(dashboard)/...`
converging under `/account`). `src/proxy.ts` (Next.js 16 permits only one
project-wide) gained a second guard block for `/admin/*`, mirroring the
existing `/account/*` one exactly — this is a UX-level redirect only, not
the security boundary; that's `requirePermission()`, enforced server-side
in the Service layer, called by every protected action.

**`(admin)/layout.tsx` is a minimal top bar** (name, role, sign-out), not
a full sidebar/dashboard shell — that's STORY-039's scope. Similarly,
`src/app/(admin)/admin/page.tsx` is a bare landing page proving the
foundation works end to end, not a dashboard. `GET /api/admin/ping`
exists purely to prove the session-gating chain for API routes (`proxy.
ts`'s matcher excludes `api/`, so every admin API route must check its
own session — this one does, with no module/action check, since "is
there a session" is all it's proving).

**STORY-Additional.md (received mid-implementation)**: a separate,
additive specification for Hero Banner/homepage media management, a
Media Library, and a Promotional Pop-up Manager — explicitly forward-
looking content/marketing feature work for later stories, not a change
to this story's scope. It maps cleanly onto the `AdminModule` enum
already defined here (`HomepageBuilder`, `MediaLibrary`, `Marketing`
already exist) and its own "recommended permissions" list (e.g.
`CONTENT_HERO_PUBLISH`, `MEDIA_UPLOAD`) is a finer-grained action
vocabulary than this story's six generic actions — a future story
building those modules should map its verbs onto the existing
View/Edit/Delete/Approve/Export/Audit actions on the relevant module
(e.g. Publish ≈ Approve, Create/Replace ≈ Edit, Archive ≈ Delete) rather
than introducing a second, competing action enum, per that document's
own "do not create duplicate systems" instruction.

**Deferred to follow-up work (see the scope note above):** self-service
admin invite-by-email (`AdminInvite` model, `/api/admin/auth/invite`,
`/api/admin/auth/accept-invite`), admin password reset
(`/api/admin/auth/reset-password`), and TOTP 2FA
(`/api/admin/auth/2fa/setup`/`verify`, no `otpauth`/`qrcode` dependency
added yet). All three were designed for in the original story doc and
remain valid future work — none of them block STORY-039+.

**Testing:** `tests/unit/permission-service.test.ts` — matrix resolution
against real seeded permission rows, the Super-Administrator-floor guard,
the last-Super-Administrator lockout guard (including the
`findOrCreateSuperAdministratorRole` test-isolation note: it must use the
real `SUPER_ADMINISTRATOR_ROLE_KEY` constant to exercise the guard's
hardcoded comparison, so the test finds-or-creates rather than always
creating, to never collide with a real seeded row's unique key).
`tests/unit/admin-auth-service.test.ts` — login success, wrong password
(no enumeration), lockout after the threshold (throwing immediately, not
returning null), a still-locked account rejecting even the correct
password, password-version force-logout. `tests/e2e/admin-auth.spec.ts`
— unauthenticated redirect with a return path, successful login reaching
the protected area, wrong-password rejection, lockout with the distinct
message, sign-out, and confirmation that an admin session cannot reach
`/account` (and, by the customer e2e suite's own unaffected passing
tests, that a customer session cannot reach admin either).

## 2026-09-30 — STORY-039 Admin Dashboard

The admin console's landing screen — 11 widgets per blueprint.md Section 7,
gated by STORY-038's RBAC. Two research passes confirmed no admin-wide
aggregation function existed anywhere yet (every existing repository
function is scoped to a single user/product/recipe), and, more
importantly, that of the 11 widgets **8 have real underlying data to
aggregate honestly and 3 do not** — Live Visitors, Export Enquiries, and
System Health have zero backing infrastructure (no session/pageview
tracking, no B2B enquiry model, no uptime/error-rate tracking), confirmed
by exhaustive grep, not just "not built yet." Per AC #13 ("if a widget's
source isn't implemented yet, render a placeholder rather than erroring"),
these three render a shared `coming-soon-card.tsx`, never fabricated data.

**Widget → `AdminModule` mapping** (all gated on the `View` action):
Today's Revenue & Orders → `Orders`; Pending Moderation (reviews/recipe
reviews/blog comments) → `Reviews`; Pending Product Q&A → `QA`; Low Stock
Alerts → `Products`; Rewards & Referrals (redemptions + signups) →
`RewardsReferrals`; Support Tickets → `Customers` (blueprint groups
support history under Customers); Failed Payments → `Orders`; ERP Sync
Status → `ERPIntegration`; Export Enquiries → `ExportPortal`; System
Health → `UsersRolesAudit` (blueprint groups "Users, Roles, Audit Logs,
System Health" together); Live Visitors → `CRMAnalytics`. The three
placeholder widgets are gated exactly like the real ones — an admin
without `ExportPortal:View`, for instance, never sees even a "coming
soon" card for Export Enquiries, so the placeholder can never leak that a
module exists to someone unauthorized for it.

**Permission checks are batched, not per-widget.**
`permission.service.ts::getPermissionsForAdminUser` already returns the
admin's full permission `Set` in one DB read;
`admin-dashboard.service.ts::getDashboardSummary` fetches it once and
checks `.has()` locally for all 11 widgets, rather than 11 separate
`hasPermission` calls (11 separate DB reads). Each real widget's data
fetch is independently wrapped in a `safe()` helper that logs and
degrades that one key to omitted on failure, never fails the whole
response — the same "don't let one broken data source take down the
dashboard" spirit as AC #13's placeholder requirement, extended to real
sources that error unexpectedly. Keys for ungranted widgets are omitted
from the JSON entirely (true server-side omission), not sent with a zero
value and hidden client-side.

**Two narrower AC deviations, both documented inline in the touched
files:** `SupportTicket` has no `priority` field, so AC #8's "broken down
by priority" is substituted with a breakdown by `status`
(`Open`/`InProgress`/`Resolved`/`Closed`, a real field) —
`support-ticket.repository.ts::countTicketsByStatus`. AC #3's fifth
sub-count ("recipe Q&A") doesn't exist as a distinct feature (only
product Q&A exists), so `pendingProductQuestions` covers product
questions only — `pending-product-qa-card.tsx`'s own doc comment.

**Low Stock threshold is a documented constant
(`LOW_STOCK_THRESHOLD = 10` in `admin-dashboard.service.ts`), not a new
`Product` field.** A real System Settings-backed threshold has no admin
UI home yet (STORY-040/054's turf) — adding the field now with nothing to
manage it would be speculative. `countLowStockProducts` also filters to
`status: "Published"` — a Draft/Archived product's stock isn't actionable
inventory for this widget.

**Recharts was dropped from the task list's frontend bullet.** No AC
actually requires a chart — AC #1 only needs a number and a same-day
order count, no trend sparkline. Adding a full charting library (not
installed, zero existing precedent anywhere in this codebase) for one
decorative element was disproportionate; the revenue card is a plain
number.

**No separate `GET /api/admin/dashboard/live-visitors` endpoint**, despite
the task list naming one — there's no real data to poll. The Live
Visitors card is a static "coming soon" card with no backing fetch.

**Every "linking into the [X] console" AC clause is deferred**, same
reasoning as STORY-038's own Out of Scope: every target console
(STORY-040 Products, STORY-045/046 Reviews/QA, STORY-047 Orders,
STORY-048 Support, STORY-049 Rewards/Referrals, STORY-056 ERP, STORY-057
System Health, STORY-058 Export) is unbuilt, so a link would 404. Cards
are informational-only for now; navigation gets added as each target
ships, exactly as the story's own Dependencies section anticipates.

**First `refetchInterval` usage in this codebase** —
`admin-dashboard-view.tsx`'s `useQuery({ refetchInterval: 60_000 })`, a
hard AC #10 requirement with no existing polling precedent to mirror. The
Server Component's own `getDashboardSummary` call seeds `initialData`, so
the first paint never shows a loading state; the client then polls the
same `GET /api/admin/dashboard/summary` route every 60s.

**Testing:** `tests/unit/admin-dashboard-service.test.ts` — a role
granted every real-widget module, seeded with one representative row per
widget, asserting the full shape and correct math (Cancelled orders
excluded from revenue, low-stock threshold, support-ticket
status breakdown, ERP pending/failed/last-synced); a role with zero
permissions gets back only the (all-false) placeholder flags; a role
granted only two placeholder modules (`CRMAnalytics`, `ExportPortal`)
gets exactly those two placeholder flags and no real widgets; a role
granted only `Orders` sees revenue and failed payments and nothing else.
`tests/e2e/admin-dashboard.spec.ts` — a fixture granted every widget
module sees every real widget plus all three placeholders; a fixture
granted only `Orders` sees a visibly reduced set; a fixture with no
permissions sees the dashboard's own empty-state message rather than an
error or a blank grid.

## 2026-09-30 — STORY-040 Admin Products Module (CRUD) — core scope

The admin authoring counterpart to STORY-009's storefront product model —
the first real content-management admin console module (STORY-038 was
auth-only, STORY-039 was read-only aggregation), so this story establishes
the first admin list/tabbed-form/bulk-action UI patterns future modules
will follow. **Scope, per the user's explicit decision** (mirroring
STORY-038's "core now, defer the rest" split): full CRUD + duplicate +
every field group editable + list view with filters/search/pagination +
bulk status actions (publish/archive/delete on a selection) ship now.
**Deferred to a fast follow-up**, blocking nothing else: CSV bulk
import/export (transactional per-row validation + downloadable error
report) and the bulk-edit modal (category reassignment, price adjustment
by amount/percent) — both meaningfully separate sub-features from the
core write-path this story otherwise delivers.

**No new pricing model** — the story's own task list says "add
`ProductPriceTier`", but STORY-009 already built 5 richer, purpose-built
models (`StandardPrice`, `SalePrice`, `CampaignPrice`,
`CustomerGroupPrice`, `VolumeDiscountTier`), and `CustomerGroup` already
has exactly the `Retail/Wholesale/Distributor/Export/PrivateLabel` values
the AC's "wholesale, distributor, export, private-label" tiers ask for.
`pricing.repository.ts` had `createXxx` for all 5 (used by the seed
script) but no update/delete/list-all — this story adds those.
`StandardPrice`/`SalePrice`/`CampaignPrice` are an **append-only ledger**
(a new row per price change, "latest"/"active" wins on read — see the
repository file's own doc comment) — `setStandardPrice` therefore always
creates a new row, never updates one, while `SalePrice`/`CampaignPrice`
windows and `VolumeDiscountTier` rungs each get real per-row update/delete
since they're independently editable entries, not a ledger.
`CustomerGroupPrice` is upserted in place (`@@unique([productId,
customerGroup])` makes a second row for the same group impossible).
**Pricing is edited via its own set of endpoints/service functions, not
bundled into `createProduct`/`updateProduct`'s payload** — a duplicated
product's images/videos/nutrition/ingredients all copy in one shot, but
pricing is deliberately excluded from that copy (see below), and the
ledger/per-row-editable/upsert shapes don't map cleanly onto one generic
"save the whole product" call anyway.

**No Media Library picker yet (STORY-041 doesn't exist).** Image/video
fields use the same plain `url`/`altText`/`sortOrder`/`isPrimary` shape
`ProductImage`/`ProductVideo` already have — the admin form gets a simple
repeatable URL-list editor per field, not a picker modal. Upgraded in
place when STORY-041 ships (same underlying schema, different picker UI)
— same pattern STORY-030/031 used for building real schema ahead of their
own admin UI.

**"Related products" is deferred** — the storefront already computes
related products algorithmically by category overlap
(`product.service.ts::listRelatedProducts`); a manually-curated override
would need a new self-relation table, out of scope for this already-large
core pass.

**`duplicateProduct` never copies pricing rows** — a duplicate starting
silently priced the same as its source risks an unnoticed wrong price
going live; the admin must set pricing explicitly on the new Draft
product. It also forces a caller-supplied slug/SKU (AC), never
auto-generated, and copies the bundle relation if present (not exposed in
the create/edit form itself this pass — bundle-type products are a narrow
enough case that full bundle-item editing is deferred alongside the other
follow-up items above).

**The Draft/Published/Archived transition set is a whitelist wider than
the AC's literal "Draft → Published → Archived" wording** — a real admin
needs to discard a draft without ever publishing it (`Draft → Archived`)
and reopen an archived product for further edits before republishing
(`Archived → Draft`), on top of the two the AC names directly. `Archived
→ Published` (direct republish) is also allowed. Anything not in
`ALLOWED_TRANSITIONS` (`product-admin.service.ts`) throws
`ProductAdminIllegalTransitionError`. `bulkChangeStatus`/`bulkDelete`
apply this per id independently and return `{ succeeded, failed }` rather
than aborting the whole batch on the first bad row — a heterogeneous
selection (some already Archived, one id stale) is expected, not
exceptional; this is a deliberately different contract from bulk CSV
import's stricter all-or-nothing validation (deferred, see above).

**`createdById`/`updatedById` added to `Product`** (nullable FK to
`AdminUser`, `onDelete: SetNull`, mirroring `Review.reviewedById`) for
audit traceability, per the story's own task list — plus the matching
`AdminUser.productsCreated`/`productsUpdated` back-relations.

**A real bug, found only by driving the actual form, not by
type-checking:** the SEO tab's `canonicalUrl`/`ogImage` fields are
optional, but a blank `<input>` submits `""`, not `undefined` — plain
`z.string().url().optional()` still runs `.url()` against `""` and
rejects it, so every product save silently failed validation (no
`serverError` shown, since react-hook-form's `handleSubmit` never calls
the submit callback on an invalid form — it just sits there with no
visible feedback because the errored fields live on the currently-inactive
SEO tab). Fixed with `.optional().or(z.literal(""))` on both fields, in
`product-admin.schema.ts`.

**The Next.js dev-mode indicator badge (fixed bottom-left) can sit
directly on top of page content that scrolls to that corner** — found via
this story's own Categories checkbox list, which happened to land exactly
there, silently intercepting every click (`<nextjs-portal>` "intercepts
pointer events") in both a manual walkthrough and Playwright. Disabled
project-wide via `devIndicators: false` in `next.config.ts` — dev-only,
no effect on the production build, and prevents the same collision for
any future admin page whose content happens to land in that corner.

**Reused `CheckboxOption`** (`src/components/storefront/listing/
checkbox-option.tsx`, originally built for storefront filter sidebars)
for every checkbox+label pairing on the product form (categories,
allergens, certifications, ingredient "Allergen", image "Primary", "In
stock") instead of hand-rolling a `<label><Checkbox/>text</label>`
pattern. That hand-rolled pattern has a real accessibility bug documented
in `CheckboxOption`'s own comment: Base UI's Checkbox, wrapped in a
`<label>` with no explicit `aria-labelledby`, falls back to the enclosing
label for its accessible name — which contains the checkbox itself, so
the self-reference resolves to an *empty* name (an axe
`aria-toggle-field-name` violation, and unreachable by
`getByRole("checkbox", { name })` in tests). `CheckboxOption` already
fixed this with `aria-labelledby` pointing at a sibling `<span>`; reusing
it was both the correct accessibility fix and avoided writing the same
bug three more times across this form.

**Testing:** `tests/unit/product-admin-service.test.ts` — create/update
persisting every field group; duplicate forcing a new slug/SKU and never
copying pricing; slug/SKU conflict → the right error class (a real
driver-specific gotcha: `@prisma/adapter-pg`'s P2002 reports the violated
column under `meta.driverAdapterError.cause.constraint.fields`, not the
classic `meta.target` Prisma's own docs describe for the built-in query
engine — `conflictField()` checks both); the transition whitelist
including an illegal-transition rejection; `bulkChangeStatus`'s
per-id success/failure shape; permission denial; the standard-price
ledger vs. sale-price upsert-in-place vs. customer-group-price unique
upsert behaviors. `tests/e2e/admin-products.spec.ts` — full lifecycle
(create every tab → list → edit → publish → archive → duplicate with a
forced new slug/SKU → bulk-delete) as a full-access fixture; a
Viewer-only fixture can browse the list but the create route denies
server-side (`AccessDenied`, not just a hidden button).

## 2026-09-30 — STORY-041 Media Library — core scope

The centralized upload/manage module every content story with an
image/video field is meant to depend on, rather than each building its own
raw uploader — `docs/stories/07-enterprise-admin-platform/
STORY-Additional.md`'s Media Library section (#2) is authoritative here.
**Scope, per the user's explicit decision** (same "core now, defer the
rest" split as STORY-038/040): folders, tags, search/filter, bulk upload
with per-file error handling, MIME/size validation, server-side-enforced
required alt text, and a genuinely reusable `AssetPickerDialog` wired into
STORY-040's product form as its first real consumer, all ship now.
**Deferred to the same future "follow-up sweep" batch** as STORY-038's
invite/reset/2FA and STORY-040's CSV import/export (per the user's
explicit "keep deferring, batch later" decision, not a per-story
follow-up): automatic compression/WebP conversion, an in-browser
cropping/resizing tool, version history with rollback, and a
usage-before-delete guard.

**Storage provider abstraction, reusing STORY-026's exact pattern.**
`docs/blueprint.md` Section 10 lists hosting/cloud provider specifics as
unconfirmed, and CLAUDE.md says not to guess at unconfirmed integrations —
the same situation STORY-026 hit for the payment gateway. `StorageProvider`
(`src/services/storage/storage-provider.interface.ts`: `upload`, `delete`)
has one working implementation, `LocalDiskStorageProvider`, selected via
`MEDIA_STORAGE_PROVIDER=local` (mirroring `PAYMENT_PROVIDER=mock`) through
`media.service.ts::getActiveStorageProvider()` — the sole place a future
S3/Cloudinary/etc. adapter plugs in.

**`LocalDiskStorageProvider` writes to `.local-media-uploads/` at the
project root, deliberately outside `public/`, not `public/uploads/media/`
as the original plan proposed.** Next.js's dev server specifically watches
`public/` to notify the browser about new static assets; writing runtime
uploads there triggers a Fast Refresh cycle on every upload, which can
remount an in-progress form and silently discard unsaved edits — found via
this story's own `AssetPickerDialog` integration test (see the Turbopack
race below; this was one of two real, independently-valuable bugs found
while chasing that symptom, not the actual root cause). Served back by a
dedicated `src/app/media-files/[...filename]/route.ts` instead of Next's
automatic `public/` static handling — unauthenticated by design (same
trust level as any other public asset URL), validates the filename against
path traversal, and sets a long-lived immutable cache header.

**Safe filenames, never the raw uploaded filename.** `buildSafeFilename()`
uses `randomUUID()` (the codebase's established convention for this —
already used in `checkout-store.ts`, `sms.provider.ts`,
`whatsapp.provider.ts`) plus the MIME-allowlist-derived extension, blocking
both path traversal and silent overwrite. The MIME allowlist
(jpeg/png/webp/svg+xml → Image, mp4 → Video, pdf → Document) and a 20MB
size cap are enforced server-side in `media.service.ts`, never trusting the
client; a failed file in a batch is collected as `{ originalName, reason }`
and does not abort the rest of the upload (AC: "a failed file doesn't
block the rest of the batch").

**Alt text is enforced at the service layer, not just the form.**
`selectAssetForPicker()` throws `MediaAssetMissingAltTextError` if
`altText` is null/empty, called by the dedicated select endpoint
(`/api/admin/media/[id]/select`) that `AssetPickerDialog` hits — a picker
consumer cannot receive an asset without alt text even if it bypassed the
UI's own inline prompt.

**No usage-before-delete guard this pass (documented deferral).** Every
existing image field (`ProductImage.url`, and eventually `Recipe.
heroImage`, `BlogPost.heroImageUrl`, etc.) is a plain string today, not a
`MediaAsset` FK — retrofitting all of them to support usage tracking is a
large cross-cutting migration disproportionate to bundle into this already
large core pass. `AssetPickerDialog` returns `{ url, altText }`, the exact
shape those fields already expect, so consumers adopt it as a
picker-or-paste-a-URL hybrid with no schema change on their side; the
FK-based retrofit and usage guard wait for the follow-up sweep once enough
consumers exist to justify it. Folder deletion still rejects with
`MediaFolderNotEmptyError` while non-empty (an unconditional block, not a
usage guard) rather than silently cascading.

**STORY-040 retrofit:** the product form's Media tab image/video rows gain
a "Browse Library" button next to the existing manual URL `Input`, opening
`AssetPickerDialog` and filling `url`/`altText` via `setValue` on
selection. Manual URL entry stays available — this is additive, not a hard
cutover — and is the first proof `AssetPickerDialog` is genuinely reusable
rather than product-form-specific.

**Two real bugs found and fixed while debugging the picker integration,
neither of which was the actual root cause (see below) but both
independently correct and kept:**
1. `existingProduct`'s `useEffect` called `reset()` on every refetch, not
   just the first — a background refetch (e.g. a portal-rendered Dialog
   stealing and returning window focus) silently wiped in-progress,
   unsaved form edits. Fixed with an `initializedProductId` ref that seeds
   the form exactly once per product id; a real navigation to a different
   product still resets. Paired with `refetchOnWindowFocus: false,
   refetchOnReconnect: false` on that query as further defense.
2. The `public/`-directory-write-triggers-Fast-Refresh issue described
   above under the storage provider.

**Root cause of the picker-integration symptom: Turbopack's dev-mode lazy
per-route compilation, not a React state bug.** Interacting with a route
immediately after `page.goto()` — before Turbopack finishes compiling that
route on its first request in the dev server process — could leave the
page half-hydrated, silently dropping a freshly-added `useFieldArray` row
moments later. Confirmed by reproducing manually (works at human speed,
fails when driven as fast as Playwright can click) and by adding `await
page.waitForLoadState("networkidle")` immediately after navigating to a
not-yet-visited route, which alone made the flaky e2e test pass reliably.
Dev-mode-only — production serves precompiled bundles and never hits this.
Two other hypotheses were tested and discarded: a `"use no memo"` React
Compiler opt-out (wrong theory — `useFieldArray`'s `fields`, unlike
`watch()`, isn't actually flagged as compiler-incompatible) and a
`setTimeout(fn, 0)` deferral of the `setValue` calls (worked once in a
slow manual repro, not reliably under Playwright's speed) — both reverted
once the real cause was found.

**Testing:** `tests/unit/media-service.test.ts` — upload validation with a
mixed valid/invalid-type batch asserting the `succeeded`/`failed` shape;
the alt-text selection gate; delete removing both the DB row and the file;
folder deletion rejected while non-empty; permission denial — against the
real `LocalDiskStorageProvider` writing to actual files (cleaned up in
`afterEach`), not a mocked provider, matching this codebase's
DB-backed-integration-test convention. `tests/e2e/admin-media.spec.ts` —
create a folder → upload (one valid, one rejected) → tag and set alt text
→ pick it from the STORY-040 product form's Media tab, confirming the
URL/alt-text fields populate → delete it back in the library, as a
full-access fixture; a Viewer-only fixture can browse the library but the
upload route denies server-side (this assertion checks only the
server-side 403, not that the Upload button is hidden client-side — per
`RequirePermission`'s own documented philosophy that hiding a UI control
is never treated as access control, and identical to STORY-040's own
Viewer-only precedent in `admin-products.spec.ts`).

## 2026-09-30 — Deferred-items review: scoping decisions

Following a full audit of every deferred/blocked item across the project
(STORY-024 through STORY-041, plus `STORY-Additional.md`), the user made
several explicit scoping calls, recorded here so they aren't re-litigated:

- **STORY-040 stays core-only.** CSV bulk import/export and the bulk-edit
  modal stay in the general follow-up sweep (STORY-038/040/041's deferred
  items, batched together per the earlier "keep deferring, batch later"
  decision) — not folded back into STORY-040 retroactively.
- **The orphaned `User.customerGroup` gap gets its own story, not a bolt-on
  to STORY-040.** Product management (STORY-040) and customer/pricing
  context are different concerns; conflating them would have made
  STORY-040 a worse precedent for future admin-module stories. See the new
  **STORY-071** (`docs/stories/06-customer-platform/
  STORY-071-customer-group-pricing-context.md`) — deliberately scoped to
  "add the field, wire the existing hardcoded call sites, test it," not a
  new pricing engine.
- **The storage/hosting provider decision is now explicitly flagged**
  (`docs/blueprint.md` Section 10) as blocking two specific features —
  review photos (STORY-015) and customer profile photo upload (STORY-034)
  — rather than sitting as a generic "unconfirmed" line. STORY-041's
  `StorageProvider` abstraction means admin media uploads aren't waiting
  on this, but those two storefront-facing features are.
- **Payment gateway, ERP system, and shipping carrier integrations stay
  deferred** exactly as originally scoped (STORY-026/027/028's own
  entries) — no change, reaffirmed rather than revisited.
- **The Promotional Pop-up Manager** (`STORY-Additional.md` sections 3–9)
  stays a future standalone story, written up once build order reaches it
  after STORY-042 (Homepage Visual Builder, which owns section #1) — no
  change, reaffirmed.

## 2026-09-30 — STORY-042 Homepage Visual Builder — core scope

The admin-side authoring tool for the storefront homepage (STORY-006),
whose 11 sections were previously hardcoded in `page.tsx`, driven mostly
by static fixture data. This story makes section order/visibility and
Hero Banner content fully admin-editable, per `docs/blueprint.md` Section
7 and `STORY-Additional.md`'s Hero Banner section (#1), authoritative
here. **Scope decisions made with the user this session** (same "core
now, defer the rest" split as every prior admin story):

1. **Hero Banner gets the full rich editor** per `STORY-Additional.md`:
   multi-banner, desktop/mobile media via the Media Library (STORY-041's
   `AssetPickerDialog`), heading, subheadline, supporting text, CTA 1 +
   optional CTA 2, overlay, alignment, banner ordering, show/hide. The
   other 10 section types get only reorder + show/hide + an optional
   title/description text override this pass — no section-specific
   editors (no Best Selling Products override list, no curated Customer
   Reviews list, etc.), explicitly deferred to later stories once their
   individual requirements are defined.
2. **Real drag-and-drop via `@dnd-kit/core` + `@dnd-kit/sortable`** — a
   new dependency; nothing in this codebase did real drag-and-drop
   before. Both the section canvas and the Hero Banner slide list use
   dnd-kit's `KeyboardSensor` alongside the pointer sensor — a real
   accessibility win, not just a testing convenience (confirmed working:
   focus the drag handle, Space to pick up, Arrow keys to move, Space to
   drop).
3. **Scheduling (auto-publish/auto-expire) is deferred.** No
   cron/job-runner exists in this codebase. Core ships Draft → Published
   with one-level rollback instead — `publishLayout` archives whichever
   layout was previously live in the same transaction that publishes the
   new one (`homepage-layout.repository.ts::publishLayoutSwappingPrevious`),
   and `rollbackToPrevious` republishes the most-recently-Archived layout
   by reusing that same primitive. No separate version-history table.
4. **Preview = view the saved draft**, not a true live/unsaved-edit-
   reflecting pane. `/admin/homepage-builder/[id]/preview` server-renders
   the real storefront section components (`HomepageSections`, shared with
   the actual storefront `page.tsx`) against the draft's saved data, with
   a client-side desktop/mobile width-container toggle — no iframe, no
   live-sync engine.
5. **Storefront shows only the first visible Hero Banner slide** (by
   `sortOrder`) this pass — no carousel/rotation library exists in this
   codebase, and building one is new UI scope beyond this story.
   Multi-banner rotation on the storefront is a flagged follow-up.

**Rollback via status reuse, not a separate history table.** A layout's
lifecycle is `Draft → Published → Archived`; publishing atomically
archives whichever layout was previously `Published` in the same
transaction, so there's never a moment with zero or two `Published`
layouts. Rollback is just "publish the most-recently-Archived layout" —
the exact same primitive, no new model needed. This gives one-level
rollback for free; a full multi-version history list is deferred.

**Storefront retrofit, with a hard "never blank" guarantee.**
`src/app/(storefront)/page.tsx` now calls
`homepage.service.ts::getPublishedHomepageLayout()` (storefront-facing,
separate from the admin-facing `homepage-builder.service.ts` — same split
as `product.service.ts` vs `product-admin.service.ts`) and renders via a
new shared `HomepageSections` component. **If no layout has ever been
published**, it falls back to the exact original STORY-006 fixture-driven
JSX — this migration must never leave the storefront broken. A new
`prisma/seed-homepage.ts` creates and publishes one initial layout
matching STORY-006's original default (11 sections in blueprint order,
one Hero Banner slide from the former `heroBanner` fixture), so a fresh
environment isn't relying on the fallback path in practice.

**A real bug found via testing, not the manual walkthrough: the
homepage route could serve a statically-cached, stale layout.**
`getPublishedHomepageLayout()` is a plain Prisma call with no Next.js
dynamic API of its own; the route's dynamic rendering was only being
forced incidentally, by `FeaturedRecipes`' own `connection()` call deep in
the tree — but `FeaturedRecipes` is just one of 11 possible sections, and
whether it renders at all depends on which sections the *currently
published* layout happens to include. A layout that omits it (e.g. this
story's own e2e test fixture, which used only `HeroBanner` +
`FeaturedCategories`) could let the whole route be treated as static,
silently serving a stale render after later publishes/rollbacks. Fixed by
calling `await connection()` directly in `page.tsx` itself, so the route
is unconditionally dynamic regardless of which sections end up rendering
— the same fix belongs anywhere a route's dynamism depends on a
conditionally-rendered child rather than the route's own top-level code.

**Ten section components gained an optional `titleOverride`
(`InstagramGallery` also `descriptionOverride`) prop**, used instead of
their previously-hardcoded heading text when a `HomepageSection` row sets
one: `featured-categories.tsx`, `why-choose-oristor.tsx`,
`best-selling-products.tsx`, `product-collections.tsx`,
`customer-reviews.tsx`, `instagram-gallery.tsx`, `featured-recipes.tsx`.
The three `TeaserSectionData`-based sections (`FoodAcademyTeaser`,
`ExportSolutions`, `RewardsClubTeaser`) needed no component changes at
all — their existing `headline`/`description` fields are simply
overridden in `HomepageSections` before the fixture data is passed down.

**A new `hero-banner-slide.tsx` component, not a rewrite of the existing
`HeroBanner`.** The pre-STORY-042 `HeroBanner` component (single banner,
one CTA, no overlay/alignment/mobile-image/video) stays completely
untouched and is used only for the fixture-driven fallback when no layout
has ever been published — zero risk to STORY-006's own tested behavior.
The new `HeroBannerSlide` component renders the richer STORY-Additional
feature set (secondary CTA, overlay scrim, alignment, mobile art direction
via two `<Image>` elements toggled by breakpoint, optional `<video>`
background) and is used only for the DB-backed path.

**A real Base UI gotcha, found live in the browser (not caught by
type-checking or lint):** every `<Button nativeButton={false}
render={<Link .../>}>` in this story's new admin components was missing
`nativeButton={false}` initially, producing a real console error ("Base
UI: A component that acts as a button expected a native `<button>`...")
— the existing `hero-banner.tsx` component already had this right, but it
wasn't obvious from that one example alone that every other `render={<Link
.../>}` usage needed the same prop. Fixed across
`homepage-builder-list-view.tsx`, `homepage-builder-canvas.tsx`, and the
preview page's "Back to editor" button.

**A real test-isolation bug, found while writing the e2e test:**
`HomepageLayout.createdBy` uses `onDelete: SetNull`. The e2e test's
`beforeEach` originally deleted `adminUser` rows *before* deleting
`homepageLayout` rows filtered by `createdBy.email` — nulling out
`createdById` on every layout that admin had created, permanently
orphaning it from that exact filter on every subsequent run. Fixed by
reordering the cleanup (layouts before their creator); five already-
orphaned layouts from this session's own debugging were cleaned up via a
one-off script. General lesson for any future story with a
`SetNull`-on-delete creator relation: order cleanup Foreign-key-dependent
rows before deleting the row they reference, even when "obviously" the
parent should go first.

**Testing:** `tests/unit/homepage-builder-service.test.ts` — blank vs.
cloned-from-published draft creation, the HeroBanner-section-cap-at-one
rejection, section add/update/duplicate/reorder, banner
add/duplicate/reorder, publish atomically archiving the previous layout,
rollback republishing the right layout, the Draft-only mutation guard,
permission denial. `tests/e2e/admin-homepage-builder.spec.ts` — build a
draft, reorder sections via dnd-kit's keyboard sensor, add a Hero Banner
slide via `AssetPickerDialog`, confirm the preview shows it, publish,
confirm the live storefront reflects it, roll back, confirm the storefront
reverts — as a full-access fixture; a Viewer-only fixture can browse but a
mutating route denies server-side.

## 2026-09-30 — STORY-043 Admin Recipes Workflow — core scope

The admin authoring counterpart to STORY-017/018's customer-facing recipe
experience, and the sole write path for the `Recipe` model those stories
read from. The data model was already unusually complete going in —
`Recipe`, `RecipeStep`, `RecipeIngredient`, `RecipeCategory`, `DietaryTag`
all existed, and `RecipeStatus` already had exactly the five values the AC
asks for (`Draft`/`Review`/`Approved`/`Published`/`Archived`) — but
nothing wrote a recipe through anything but the seed script until this
story. **Scope decisions made with the user this session:**

1. **Built directly on `Recipe`, not on STORY-053.** The story doc's own
   "Dependencies" section says this should plug into STORY-053's shared
   CMS Workflow & Versioning engine — but STORY-053 doesn't exist yet
   (much later in build order), and every other admin module so far
   (STORY-040 Products, STORY-042 Homepage Builder) built its own
   lightweight workflow directly on the model instead of waiting for a
   shared engine nothing else needs yet either. This story does the same:
   an `ALLOWED_TRANSITIONS` whitelist in `recipe-admin.service.ts`,
   role-gated via STORY-038 permissions, audit-logged — same shape as
   `product-admin.service.ts`'s transition guard. A deviation from the
   stale reference, documented here rather than silently diverging;
   nothing here blocks a future STORY-053 from absorbing it into a shared
   engine.
2. **Full version history (snapshot-every-publish, browsable,
   rollback-to-any-version) is deferred**, consistent with STORY-042
   deferring the same thing for homepage layouts. Core still ships the
   real safety net the AC cares about: nothing reaches `Published`
   without passing through `Review`/`Approved`, and a reviewer's
   reject-with-comment sends it straight back to the original author with
   the comment visible.
3. **Scheduling (auto-publish at a future date/time) is deferred** — same
   reason as every prior story this session: no cron/job-runner exists in
   this codebase yet.

**Workflow:** `Draft --submit--> Review --approve--> Approved
--publish--> Published --archive--> Archived --restore--> Draft`, plus
`Review --reject(comment)--> Draft` and `Approved --reject(comment)-->
Draft` (a reviewer can still catch something before it goes live).
Gating uses the existing `"Recipes"` module from STORY-038's permission
matrix — no new `AdminModule` rows needed. `AdminAction` already includes
`Approve` (confirmed before assuming otherwise), so `approve`/`reject`/
`publish` are gated on `Approve` specifically, distinct from the `Edit`
grant that covers create/update/submit/archive/restore — a dedicated unit
test confirms an Edit-only admin is denied on `approve()`.
`reviewerComment: String?` on `Recipe` is overwritten each rejection
cycle and shown to the author on the Draft; the full who-rejected-when-why
history lives in the audit log's `metadata`, so no separate comment-log
table was needed.

**Publish-readiness guard:** `publish` (and `submitForReview`, since
nothing reaches Published without first passing Review) throws
`RecipePublishReadinessError` unless the recipe has a hero image + alt
text, at least one ingredient, and at least one step.

**Preview reuses the real storefront transformation, not a duplicate
mapping.** `recipe.service.ts::toRecipeDetail` was made `export`ed
specifically so `recipe-admin.service.ts::getRecipeForPreview` could
reuse the exact same row-to-DTO transformation against
`findRecipeAdminDetailById` (any status) instead of
`findPublishedRecipeBySlug` (Published-only) — the same "server-render
the real components against non-published data, admin-only route"
pattern STORY-042 established for the Homepage Builder preview. This
guarantees the admin preview and the real storefront page can never
structurally drift apart.

**A real bug found via testing, not caught by type-checking:**
`register(name, { valueAsNumber: true })` reads the native `<input
type="number">`'s `.valueAsNumber` DOM property, which is `NaN` (not
`undefined`) for an empty input. Zod's `.optional()` only accepts
`undefined` — `.number()` explicitly rejects `NaN` — so any *optional*
numeric field left blank (e.g. an ingredient with no quantity, "salt to
taste") silently failed validation with no network request ever firing
and no visible error on whichever tab was currently active (the error
renders on the tab that owns the field, which may not be the visible
one in a Tabs-based multi-tab form). Diagnosed by elimination: a network
listener showed zero requests fired (client-side validation, not a
server issue) → a per-tab error-text scan isolated it to the Ingredients
tab → traced to the unfilled Quantity field. Fixed with a shared
`optionalNumber = { setValueAs: (v) => v === "" ? undefined : Number(v)
}` transform, applied only to the 7 genuinely-optional numeric fields
(ingredient quantity + 6 nutrition fields) — `servings`/
`prepTimeMinutes`/`cookTimeMinutes` correctly keep `valueAsNumber: true`
since NaN failing their non-optional `z.number()` check is the *correct*
"this is required" behavior for those.

**A real, pre-existing, codebase-wide bug found but NOT fixed here
(flagged as a follow-up):** `SelectValue`
(`src/components/ui/select.tsx`) has no label-resolution logic — it
displays the raw stored `value`, not the matching `SelectItem`'s child
label text, whenever `value !== label`. This is invisible on selects
where the value happens to equal the label (Difficulty, Video Provider),
which is why nothing caught it before. Confirmed live in this story's own
Category select (a cuid rendered instead of the category name) both via
an e2e diagnostic and in this story's live-browser verification, while
the same field renders correctly in read-only contexts (the storefront
preview, the admin list view) that resolve the name server-side instead
of through this client component. The admin Products module's
Brand/Category selects almost certainly have the identical bug — never
caught there because `admin-products.spec.ts`'s e2e test never exercises
those specific fields. Out of scope for this story; needs its own
`SelectValue` fix as a shared-component investigation.

**Two recurring Base UI/testing gotchas, same class as prior stories:**
(1) the recipe form's Preview button was missing `nativeButton={false}`
on its `render={<Link .../>}` — the same omission fixed repeatedly in
STORY-042; (2) the e2e Reject-dialog test initially used
`.getByRole("button", { name: "Reject" }).nth(1)`, assuming two
same-labeled buttons were both queryable — but Base UI's `Dialog` makes
background content inert while open, so only the dialog's own button was
actually in the accessibility tree at that moment, and `.nth(1)` never
resolved. Fixed by scoping the query to `page.getByRole("dialog")`
first, which is robust regardless of the exact inert-background
mechanics.

**Testing:** `tests/unit/recipe-admin-service.test.ts` — create/update
with ingredients and steps (replace-all semantics), duplicate-slug
rejection, the full Draft→Review→Approved→Published→Archived→Draft
transition matrix, reject sends Review/Approved back to Draft with a
visible comment, illegal transitions rejected (Draft→Published direct,
Approved→Archived direct), the publish-readiness guard's three
sub-checks (missing hero image / no ingredients / no steps), Draft-only
delete, permission denial, and approve/reject/publish requiring `Approve`
specifically rather than just `Edit`. `tests/e2e/admin-recipes.spec.ts`
— author creates a recipe, submits for review; reviewer previews it
(confirms the storefront-shared render), rejects with a comment; author
sees the comment, fixes, resubmits; reviewer approves and publishes;
confirms the real storefront `/recipes/[slug]` now serves it — as an
author/reviewer two-role fixture; a Viewer-only fixture can browse but a
mutating route denies server-side. Verified live in the browser as the
seeded Super Administrator through the full
Draft→Review→reject→Draft→resubmit→Approve→Publish→storefront path.

## 2026-09-30 — STORY-044 Admin Blog Editor — core scope

The admin authoring and moderation counterpart to STORY-021's already-
shipped customer-facing blog. STORY-021 built the full storefront read
path (`BlogPost`/`BlogAuthor`/`BlogTag`/`BlogComment`, markdown rendering
via `MarkdownContent` + `parseBodyBlocks`, a comment submission flow with
rate limiting and a honeypot) but had **no write path for posts at all**
— the only way a post existed before this story was `prisma/seed-blog.ts`.
Comment moderation logic already existed in `blog.service.ts`
(`canTransitionComment`/`changeCommentStatus`), explicitly left unwired
to any admin surface with a comment pointing at "the moderation console
(Epic 07's STORY-044/045)."

**Scope decisions made with the user this session:**

1. **Markdown-based editor, not WYSIWYG.** The story's AC asks for a rich
   text editor persisting "structured (not raw HTML string)" content, but
   `BlogPost.bodyContent` is already plain markdown with `[[recipe:slug]]`
   / `[[video:url]]` block embeds, and no rich-text editor library is
   installed (only read-only `react-markdown`). The user confirmed:
   keep it markdown-based. `blog-body-editor.tsx` is a textarea + a
   formatting toolbar (bold/italic/heading/link/list/blockquote, an
   "Image" button that opens the Media Library and inserts standard
   markdown image syntax, "Recipe embed"/"Video embed" buttons that
   insert the existing `[[recipe:...]]`/`[[video:...]]` tokens) plus a
   Preview toggle rendering through the real `MarkdownContent` component
   — the exact same render path the storefront uses. `bodyContent` stays
   a plain `String` column; zero schema change to that field, zero risk
   to STORY-021's shipped rendering.
2. **`BlogAuthor` stays the public byline; `createdById`/`updatedById`
   added for an internal audit trail.** Mirrors STORY-040/043 exactly —
   `BlogPost.authorId → BlogAuthor` (curated brand voice, e.g. "The
   Oristor Kitchen Team") is unchanged; the console's "who authored this"
   trail is a separate, optional `AdminUser` relation.
3. **`BlogPostStatus.Scheduled` is never written — it's a derived
   display label, not a stored value.** Confirmed before building
   anything: grepping `src/` showed the literal `"Scheduled"` value is
   never read or written anywhere in the codebase, and `seed-blog.ts`'s
   own `scheduledIntoFuture` metric is already computed as `status ===
   "Published" && publishedAt > now` — its one "scheduled" example post
   is seeded with `status: "Published"`, `publishedAt: "2099-01-01"`. The
   storefront's `publishedWhere` already gates visibility on `status ===
   "Published" AND publishedAt <= now`, so a future `publishedAt` is
   already correctly invisible with zero cron needed. This story follows
   the same design already present in the codebase: publishing always
   writes `status: "Published"` (whatever the date), and `deriveEffective
   Status()` (`src/lib/blog-post-status.ts`, a pure function with no
   server imports so both the service and the client list view can use
   it) computes `Scheduled` vs. `Live` from `publishedAt` vs. now, purely
   for display. The Publish dialog doubles as the Schedule action — pick
   a future date/time and the "Publish" button is labelled the same, the
   only difference is the date. Verified live: the seeded "Our Plans for
   Next Year's Product Lineup" post (the `scheduledIntoFuture` example)
   correctly shows "Scheduled" in the admin list with zero code changes
   needed to make that true.
4. **Comment moderation wraps the existing STORY-021 service, not a
   rebuild.** `blog-admin.service.ts`'s `approveComment`/`rejectComment`/
   `hideComment` are thin wrappers adding `requirePermission` + audit
   logging around `blog.service.ts`'s existing `canTransitionComment`/
   `changeCommentStatus` — the exact transition table STORY-021 already
   built (`Pending → Approved|Rejected`, `Approved → Hidden`) is reused,
   not reimplemented. A `deleteComment` repository function was added
   (didn't exist before). **Deviations from the story's own AC, both
   driven by what `BlogCommentStatus` actually supports** (`Pending/
   Approved/Rejected/Hidden` — no fifth value): no separate "Spam" status
   — a spam flag folds into Reject rather than adding an enum value that
   STORY-045's later unified status vocabulary would also need to absorb;
   "Reply" (an admin-authored public reply attached to a comment) needs
   new fields/threading this story has no model for, and STORY-045's own
   description already frames Reply as part of its own unified console —
   deferred there, not built twice. The moderation queue built here
   (`admin-blog-comments-view.tsx`) is blog-scoped, not the unified
   across-source console STORY-045 will eventually build; STORY-045's own
   task list already expects to reuse this story's `blog-comment.service`
   pattern rather than duplicate it.
5. **SEO fields added to `BlogPost`**: `metaTitle`/`metaDescription`/
   `ogImage` (`String?`, matching the exact field names already used on
   `Product`/`Recipe`). `blog/[slug]/page.tsx`'s `generateMetadata` now
   prefers these when set, falling back to `title`/`excerpt`/
   `heroImageUrl` exactly as before — also now sets `openGraph` fields,
   which it didn't before this story.
6. **No autosave.** The AC asks for periodic autosave, but nothing else
   in this admin console autosaves — Product/Recipe/Homepage-Builder are
   all explicit-Save. Deferred; would be the first of its kind with no
   established pattern and risks silently creating/mutating Draft rows
   the admin didn't explicitly ask to save.
7. **Related products / related recipes** (mentioned in the story's
   Description bullet list, not its AC) were dropped — no relation exists
   on `BlogPost` to build on and nothing in STORY-021's storefront
   rendering or the blueprint's one-line Blog bullet calls for them. Same
   class of stale-spec drift STORY-043 found with its STORY-053
   reference.

**Reading time is always computed, never manually entered.**
`computeReadingTimeMinutes()` (`src/lib/blog-reading-time.ts`, 200
words/minute, minimum 1) is the only place it's derived — no manual
override field in the form — same "compute it, don't ask" rationale as
Recipe's `computeTotalTimeMinutes()`.

**Preview reuses the real storefront transformation, not a duplicate
mapping.** `getPostForPreview()` parses `bodyContent` through the exact
same `parseBodyBlocks()` and resolves recipe embeds through the exact
same `getRecipeCardsBySlugs()` that `blog.service.ts`'s `getPostBySlug()`
uses, then renders through the real `BlogPostBody` storefront component —
the same "server-render the real components against non-published data,
admin-only route" pattern as STORY-042/043's own preview routes. Comments
and related-posts are skipped, matching Recipe's own precedent of
dropping customer-account-dependent pieces from an admin preview.

**Testing:** `tests/unit/blog-admin-service.test.ts` (15 tests: post
create/update with tags, duplicate-slug rejection, publish with no date
vs. a future date (confirms `deriveEffectiveStatus` computes Live/
Scheduled correctly without ever storing "Scheduled"), archive/restore,
Draft-only delete, permission denial; comment approve/reject/hide via the
real transition table, illegal-transition rejection, delete, a bulk
moderate test with a mixed valid/invalid selection confirming partial
success (`{updated, skipped}`) rather than an all-or-nothing failure,
Approve-specifically-required for moderation actions).
`tests/e2e/admin-blog.spec.ts` (3 tests: author creates a post with a tag
and a `[[recipe:slug]]` embed, publishes immediately, confirms it's live
on `/blog/[slug]` with the embed resolved through the real `RecipeCard`
component, then a reviewer approves a seeded Pending comment and confirms
it appears on the published post; a second post is scheduled into the
future, confirms the admin list shows "Scheduled" and the storefront
`/blog` listing omits it; a Viewer-only fixture can browse both admin
pages but a mutating route denies server-side). Verified live in the
browser as the seeded Super Administrator: created a post with a real
recipe embed, previewed it, published it, confirmed it rendered correctly
on the real storefront with the byline/reading-time/embed all correct,
then archived → restored → deleted it to clean up.

**A real environment issue hit during this session, not a code bug:**
a system-wide low-memory event killed the local `prisma dev` and `next
dev` processes mid-session. After restarting both, every e2e test failed
at sign-in with `/api/admin/auth/csrf` returning 404 — not a real auth
regression, but a corrupted Turbopack `.next` dev cache left over from
the processes having been force-killed (`taskkill /F`) rather than
shut down gracefully. Fixed by deleting `.next` and doing a clean `npm
run dev` restart. General lesson for this project: after a forced kill
of the dev server (as opposed to a clean stop), if routes start 404ing
that shouldn't, clear `.next` before assuming it's a real bug.

## 2026-10-01 — STORY-045 Reviews Moderation Console — core scope

The moderation console for content already submitted through three
already-shipped storefront features: STORY-015 (Product Reviews),
STORY-022 (Recipe Reviews), and STORY-021/044 (Blog Comments). All three
already had a complete status-transition service
(`review.service.ts::changeReviewStatus`, `recipe-review.service.ts
::changeRecipeReviewStatus`, `blog.service.ts::changeCommentStatus`) —
each one's own doc comment explicitly said "approved from the moderation
console (Epic 07, STORY-045)." Nothing admin-facing existed yet. This
story builds that console, unifying all three into one queue.

**A real pre-existing bug found and fixed before building anything:**
`Review.reviewedById` — fields explicitly commented "Reserved for the
STORY-045 moderation console" in STORY-015 — pointed at `User` (a
customer account), not `AdminUser`. A moderator is an admin, never a
customer; since nothing had ever written to this field before this
story, retargeting the relation to `AdminUser` was a safe, purely
additive-risk fix (confirmed via the pre-existing
`tests/unit/review-lifecycle.test.ts` test, which had to be updated to
pass a real `AdminUser` id instead of a `User` id — a second confirmation
the old relation was simply wrong, not an intentional design choice).

**Scope decisions made this session:**

1. **Reply, Feature, and a manual reward grant all needed new fields/
   primitives — built directly here, not deferred.** Unlike STORY-044
   (which could legitimately defer Reply to "STORY-045's own console"),
   this story IS that console.
   - **Reply**: `adminReplyBody String?` added to `Review`, `RecipeReview`,
     and `BlogComment` — one overwritable reply slot per item, no
     threading, matching `moderatorNote`'s existing shape.
   - **Feature**: `featured Boolean @default(false)` added to `Review`
     and `RecipeReview` only, not `BlogComment` (a comment has no
     rating/quote to curate). **Important limitation, confirmed and
     deliberately not fixed**: the AC says Feature should be "consumable
     by the Homepage Visual Builder's Customer Reviews section" — but
     STORY-042 never actually built curated-review consumption;
     `customer-reviews.tsx` still renders STORY-006-era fixture data
     (`ReviewData`/`quote`/`authorLocation`, a different shape entirely)
     with no curated-ID mechanism at all. This story adds the `featured`
     flag and its toggle — real and useful on its own — but does NOT
     wire it into the Homepage Builder, since that consumption mechanism
     doesn't exist yet and building it is STORY-042/homepage-builder
     scope, not this story's. Flagged as a follow-up.
   - **Hide**: `ReviewStatus` gained a `Hidden` value (`Published ->
     Hidden`, `Hidden -> Published`) so all three content types now
     uniformly support a Hide side-state, matching
     `RecipeReviewStatus`/`BlogCommentStatus`'s existing shape. The
     exhaustive transition-matrix test in `review-lifecycle.test.ts` was
     extended to cover every `Hidden`-involving pair, not just the two
     new ones, so the whole matrix stays provably exhaustive.
   - **Reward Customer**: a new `grantManualPoints(userId, points, note)`
     in the existing `rewards.service.ts` (STORY-030) — writes an
     `Earned`-type `RewardTransaction` with `orderId: null` (Postgres
     allows multiple NULLs under `@@unique([orderId, type])`, so this
     can never collide with an order-based credit), reusing the exact
     same account-bootstrap/transaction-write/notify/tier-evaluation
     primitives `creditPointsForConfirmedOrder` already uses. The user
     explicitly confirmed building this now rather than gating it behind
     STORY-049 (Rewards & Referrals Campaign Management), which doesn't
     exist yet — a manual grant primitive, not a campaign system.
2. **Notification + rating recalculation on approve applies to product/
   recipe reviews only**, not blog comments — the AC's own wording is
   specific: "Approving a **review** triggers a customer notification and
   recalculates the target **product's or recipe's** aggregate rating."
   A comment has no rating to recalculate. Two new notification
   templates (`review.approved`, `recipe_review.approved`) were seeded
   alongside the existing 6 in `seed-notifications.ts`; recalculation
   reuses the exact existing `updateStatusAndRecalculate`/
   `updateReviewStatusAndRecalculate` repository functions — zero new
   recalculation logic written.
3. **Blog-comment moderation taken through this console gates on the
   "Reviews" module, not "Blog"** — deliberately distinct from
   STORY-044's own `admin-blog-comments-view.tsx`, which gates on
   "Blog". Customer Support (the AC's named persona for this console)
   has "Reviews" as a home module by STORY-038's seed matrix but only
   `View` on "Blog"; gating this console's blog-comment actions on
   "Blog" would make the unified queue useless to that persona for
   exactly the thing it was built for. Both consoles remain valid,
   independent entry points to the same underlying
   `blog.service.ts::changeCommentStatus` — "two doors, one lock," not a
   conflict.
4. **The three lifecycles are genuinely asymmetric, and the UI doesn't
   pretend otherwise.** Product reviews are Pending -> Approved ->
   Published -> Archived (Approved is NOT yet publicly visible —
   Published is, a real two-step gate already shipped in STORY-015).
   Recipe reviews and blog comments are Pending -> Approved -> Hidden
   (Approved IS the visible state already, no separate publish step, and
   Hidden is terminal — no restore — in their own already-shipped
   STORY-021/022 design, not reopened here). Approve/Reject/Hide are
   offered uniformly across all three (each domain's own `canTransition*`
   check is still the real authority); Publish/Archive/Restore are
   product-only, both in the service (`review-moderation.service.ts`)
   and in the admin UI's per-row action computation.
5. **The unified queue's pagination is per-source when one source type is
   filtered, and a bounded merge when "All sources" is selected** — three
   differently-shaped tables can't share one SQL query. A specific
   `sourceType` filter paginates that table directly (efficient,
   unlimited depth). "All" fetches up to `page * pageSize` rows (capped
   at 500) from each of the three sources, merges and sorts them by
   `createdAt` in the service layer, then slices to the requested page —
   correct and simple at this console's expected volumes, with a known,
   documented limitation that true cross-source pagination at scale is a
   deferred concern (same "build what's needed now" principle as every
   prior story). A status filter invalid for a given domain (e.g.
   `Published` when merging in a recipe review, which has no such status)
   excludes that domain's rows entirely rather than silently ignoring
   the filter for it.
6. **No photo-review moderation UI.** `ReviewImage` exists in the schema
   but is explicitly unused until a storage provider is chosen
   (STORY-015's own note) — nothing to moderate yet, consistent with
   that existing deferral.

**A real bug found and fixed while writing the first unit tests, not by
inspection:** `recipe-review.service.ts::changeRecipeReviewStatus` wrote
the new `reviewedById` via a relation-`connect` object
(`data.reviewedBy = { connect: { id } }`), but the underlying repository
write (`updateReviewStatusAndRecalculate`) uses Prisma's `updateMany`,
which only accepts scalar field updates — relation operations like
`connect` are a `update`-only shape and throw `Unknown argument
reviewedBy` under `updateMany`. Fixed by writing the scalar FK directly
(`data.reviewedById = id`) and changing the data parameter's type from
`Prisma.RecipeReviewUpdateInput` to
`Prisma.RecipeReviewUncheckedUpdateInput` to match. General lesson: any
write that goes through `updateMany` (used throughout this codebase's
conditional-write pattern, e.g. "only update if status still matches")
must use the Unchecked/scalar-FK input type, never the relation-based
one — a mistake that compiles fine (both are valid Prisma input types)
but fails at runtime only on the `updateMany` path specifically.

**Testing:** `tests/unit/review-moderation-service.test.ts` (14 tests —
approve/reject/hide/restore across all three source types, confirming
product-review approval does NOT yet make it visible (Approved !=
Published) while recipe-review approval both makes it visible and
recalculates `Recipe.avgRating`/`ratingCount`, and blog-comment approval
triggers neither notification nor recalculation; reply persisted for all
three; feature toggle works for product/recipe and is rejected for blog
comments; reward-customer credits the wallet with a real
`RewardTransaction` row and is rejected for a guest (no-account) blog
commenter; bulk-approve across source types with a correctly-skipped
non-Pending item; permission denial). `tests/e2e/admin-reviews.spec.ts`
(2 tests — a moderator sees all three source types in one queue, approves
and publishes a product review and confirms it's live on the real PDP,
rejects a recipe review, replies to and features the product review; a
Viewer-only fixture can browse but a mutating route denies server-side).
Also re-ran and fixed the pre-existing `review-lifecycle.test.ts` (the
`AdminUser`-not-`User` fix above) and confirmed zero regressions across
`review-service`, `review-repository`, `recipe-review-service`,
`recipe-review-repository`, `rewards-service`, and all STORY-044 blog
tests (183 tests total, 10 files). Verified live in the browser as the
seeded Super Administrator: filtered the queue by source type, replied
to and featured a published product review, hid then restored another,
and issued a manual reward grant — confirmed via a direct database query
that it wrote a real `orderId: null` `Earned` transaction to the
customer's wallet.

## 2026-10-01 — STORY-046 Q&A Moderation Console — core scope

The admin-side workflow for questions already submitted through
STORY-016 (Product Q&A). `qa.service.ts` already had a complete
status-transition service (`canTransitionQuestion`/`answerQuestion`/
`changeQuestionStatus`, matching the blueprint's submit -> answer ->
approve -> publish flow exactly) with a comment saying "the STORY-046
moderation console calls them." Nothing admin-facing existed until now.

**Scope narrowed to Product Q&A only — no `RecipeQuestion` model, no
unified cross-source queue, unlike STORY-045.** The blueprint's admin
console bullet mentions "recipe Q&A," but this was confirmed stale by
three independent, already-documented decisions from earlier stories,
not guessed at fresh this session: STORY-022's own deviation note
("Recipe Q&A — not specified for recipes in the blueprint; Q&A is
specified for products, STORY-016"); STORY-039's dashboard widget
comment and its own architecture-decisions entry ("AC #3's fifth
sub-count ('recipe Q&A') doesn't exist as a distinct feature"); and
`qa.repository.ts::countPendingQuestions`'s own comment making the same
point. A separate, user-specified follow-on story (STORY-047, "Recipe
Q&A — Lightweight") adds an isolated Recipe Q&A module later, explicitly
without touching this story's data model or console.

**A real pre-existing bug found and fixed before writing any code, the
same pattern as STORY-045's `Review.reviewedById`:**
`Question.answeredById`/`answeredBy` — fields explicitly commented
"Reserved for STORY-046" in STORY-016 — pointed at `User` (a customer
account), not `AdminUser`. A moderator is staff, never a customer.
Nothing had ever written to this field before this story, so retargeting
the relation to `AdminUser` was a safe, purely additive-risk fix,
confirmed by the pre-existing `qa-lifecycle.test.ts` and
`qa-repository.test.ts`, both of which had been passing a `User.id` as
the moderator and needed updating to pass a real `AdminUser.id` instead
— a second confirmation the old relation was simply wrong.

**Scope decisions made this session:**

1. **Added `approvedById`/`approvedBy` (`AdminUser?`) + `approvedAt`, and
   an internal-only `rejectionReason String?`** — the two fields the
   story's own task list asked for that didn't exist yet. `rejectionReason`
   is never shown to the customer; a Rejected question is structurally
   invisible on the storefront regardless, since
   `listPublishedQuestions` only ever selects `status: "Published"`.
2. **Separation of duties (the AC's "answer-authoring staff cannot
   self-approve their own answers") is satisfied by RBAC alone, not a
   new same-user runtime check.** The AC's own wording — "RBAC can be
   **configured** so..." — describes role configuration, not new
   enforcement code. `answer()` gates on `QA`/`Edit`; `approve()`/
   `reject()`/`publish()` gate on `QA`/`Approve` — the same Edit-vs-
   Approve split already used for Recipes (STORY-043) and Reviews
   (STORY-045). A role granted only `Edit` can draft answers but cannot
   call the approve/publish endpoints at all; verified in both the unit
   suite (a permission-denial test) and the e2e spec (a dedicated
   author/reviewer pair across two sign-ins, plus a direct 403 check
   that the author's own session cannot call the approve route).
3. **"Public unable-to-answer" is a specially-worded Answer, not a
   separate code path.** Re-reading the AC: a question "can be rejected
   with either an internal-only reason... or a public 'unable to answer'
   response." The internal-only path is the real `reject(reason)`
   (status -> `Rejected`, `rejectionReason` stored). The "public" path
   needs no new state at all — staff write the polite decline as the
   ordinary `answerText` and it goes through the **normal**
   answer -> approve -> publish pipeline, exactly like any other answer.
   This avoids a third, redundant pathway the schema doesn't need; noted
   directly in the Answer dialog's own helper text.
4. **Real customer notification on publish; admin notification on
   submit deliberately stays the existing console-log placeholder, not a
   new channel.** `qa-notifications.ts` already had exactly the
   provider-registration seam this needed
   (`registerQaNotifier()`/the module-level `holder`, explicitly
   commented "STORY-032 registers real delivery... until then the
   default notifier just logs"). This story makes the default notifier's
   `onQuestionPublished` call the established `sendNotification()`
   (STORY-032/044/045 precedent) against a new `qa.question_answered`
   template (seeded alongside the existing 9). `onQuestionSubmitted`
   (the admin-facing "notify admin" half) stays log-only — nothing in
   this codebase has ever built an admin-targeted notification channel
   (email/Slack to staff) to extend, and the admin Dashboard's
   already-shipped live "Pending Product Q&A" count widget (STORY-039)
   already gives staff real-time visibility for that half of the AC. A
   deliberate, documented deferral, not a silent gap — building a
   genuinely new internal-alert subsystem would be disproportionate
   scope for this story.
5. **No dedicated "target product" filter control; the existing search
   box also matches the joined product's name.** Simpler than adding a
   product picker, and covers the AC's filter requirement without new
   UI — `qa.repository.ts::listQuestionsForAdmin`'s `search` clause now
   OR-matches `text`, `answerText`, and `product.name`.
6. **The "unanswered only" SLA-style saved view from the AC is just the
   queue's default status filter (`Pending`) on load** — not a separate
   saved-views mechanism, consistent with "build what's needed now."
7. **Bulk approve and bulk publish**, mirroring STORY-044/045's
   `{updated, skipped}` partial-success shape exactly.

No `AdminModule`/seed changes needed — `QA` already existed in
`ALL_MODULES` and Customer Support's home-module grant already included
it from STORY-038's seed matrix. No admin nav/sidebar entry was added —
confirmed by reading `src/app/(admin)/layout.tsx` and STORY-039's
dashboard cards that this project has no persistent admin sidebar or
module-linking convention at all yet (every prior console, including
Reviews in STORY-045, is reached by a direct URL); not a gap introduced
by this story.

**Testing:** `tests/unit/qa-moderation-service.test.ts` (10 tests —
answer records `answeredById` as a real `AdminUser`; approve records
`approvedById`/`approvedAt`; publish requires going through Answered and
Approved first and sends the real customer notification (verified via a
real `NotificationLog` row, not a mock); reject at any stage stores
`rejectionReason` and confirms the question is structurally invisible to
`listPublishedQuestionsForProduct`; illegal transitions and an unknown
question are rejected; an Edit-only admin can answer but not
approve/publish (separation of duties); a View-only admin cannot
answer; queue listing by status and by product-name search; bulk-approve
with a correctly-skipped non-Answered item). `tests/e2e/admin-qa.spec.ts`
(2 tests — a dedicated author/reviewer pair: the author answers, is
denied approving their own answer (403, verified directly against the
API), then a separate reviewer approves and publishes, confirmed live on
the real PDP; a Viewer-only fixture can browse but a mutating route
denies server-side). Fixed two pre-existing test regressions from the
`answeredById` retarget (`qa-lifecycle.test.ts`'s and
`qa-repository.test.ts`'s moderator fixtures, both switched from a
`User` to a real `AdminUser`) and one from the notifier default-behavior
change (`qa-notifications.test.ts`'s "default notifier" test, split so
the published-event half asserts against a mocked `sendNotification`
rather than the old log-only expectation). Full QA-related regression
(`qa-lifecycle`, `qa-notifications`, `qa-repository`, `qa-service`,
`qa-routes`) confirmed green at 68 tests. Verified live in the browser
as the seeded Super Administrator: answered a pending question, approved
it, published it, and confirmed it appeared on the real PDP with the
answer text; rejected a different question with an internal reason and
confirmed it never appeared on the storefront.

## 2026-10-01 — STORY-046.1 Recipe Q&A (Lightweight) — core scope

A user-supplied spec, filed as `docs/stories/07-enterprise-admin-platform/
STORY-046.1-Recipe Q&A-Lightweight.txt` and referred to as **STORY-046.1**
everywhere (not "STORY-047" — the real backlog's own STORY-047 is "Admin
Orders Console," confirmed in the prior session's full backlog survey
and recorded in `docs/blueprint.md` Section 9a). Adds customer Q&A to
Recipes as a deliberately isolated, lightweight sibling of Product Q&A
(STORY-016/046): reuses its patterns closely, but shares no code path
and no data model with it, and is reachable through a separate admin
console, never merged into `/admin/questions`.

**A deliberate deviation from this session's own Review/RecipeReview
precedent, decided before writing any code:** `Review`/`RecipeReview`
keep separate status enums because their pipelines genuinely differ
(`ReviewStatus` has extra Published/Archived/Hidden states
`RecipeReviewStatus` doesn't). `Question`'s 5-state pipeline
(`Pending → Answered → Approved → Published`, `Rejected` from any state)
is something `RecipeQuestion` needs **identically**, not just similarly
— so `RecipeQuestion.status` reuses the existing `QuestionStatus` enum
directly rather than cloning it into a `RecipeQuestionStatus`. This is
the one place this story intentionally does NOT mirror the "each domain
owns its own enum" pattern, because here the two domains' state machines
are the same machine, not two similar ones.

**Scope decisions:**

1. **Relation naming follows Recipe's own siblings (`customerId`/
   `customer`), not Product Q&A's (`userId`/`user`)** — confirmed by
   reading `RecipeReview` and `RecipeBookmark`, both of which already
   use `customerId`. `RecipeQuestion.customerId` matches its epic's own
   convention rather than copying Product Q&A's field name verbatim.
2. **No provider-registry indirection for the PDP summary.** Product
   Q&A's publish-count-to-PDP path goes through
   `product-detail-extensions.ts`'s `registerQaSummaryProvider` seam;
   Recipe Reviews (STORY-022) never used anything like that —
   `recipes/[slug]/page.tsx` just calls `listApprovedReviewsForRecipe
   (recipe.id, ...)` directly, server-side. `RecipeQuestion` mirrors
   that simpler pattern: `listPublishedQuestionsForRecipe(recipe.id,
   ...)` called directly in the page component, no registry, no
   `instrumentation.ts` wiring needed.
3. **Each domain owns its own error hierarchy, confirmed as the
   project's real pattern** (both `recipe-bookmark.errors.ts` and
   `recipe-review.errors.ts` independently define their own
   `RecipeNotFoundError` — never shared). `recipe-qa.errors.ts` does the
   same, mirroring `qa.errors.ts`'s shape rather than importing from it.
4. **Admin actions gate on the existing `QA` module** — per the spec's
   own "do not introduce a new permission system," identical to Product
   Q&A. No `AdminModule`/seed changes. Separation of duties is the same
   story as STORY-046: `answer()` gates on `Edit`, `approve()`/
   `reject()`/`publish()` gate on `Approve` — satisfied by existing RBAC,
   not new enforcement code.
5. **Two things deliberately omitted vs. Product Q&A, to keep this
   genuinely lightweight per the spec's own instruction:** no "my open
   questions" tracking widget (the spec only asks for "submit" and "view
   published," not a personal pending-questions view), and no search box
   on the customer-facing list (the admin side still gets a search-matches-
   joined-recipe-title trick, same as STORY-046's product-name search, to
   satisfy the spec's "Recipe filter" requirement without a picker).
6. **Real customer notification on publish, built right the first time**
   — `recipe-qa-notifications.ts`'s default notifier calls
   `sendNotification()` from the start (no log-only placeholder
   transition this time, unlike STORY-046's `qa-notifications.ts`, which
   had to evolve from a pre-existing placeholder). A new
   `recipe_qa.question_answered` template was seeded alongside the
   existing 9 (confirmed via a reseed reporting `templateTypes: 10`).
   No admin-notify-on-submit channel — the spec's own functional list
   only names the customer-notify step ("Customer receives the existing
   notification when their answer is published"), consistent with
   STORY-046's documented deferral (no admin-alert infrastructure exists
   anywhere in this codebase to extend).
7. **`RecipeQuestion.answeredById`/`approvedById` targeted `AdminUser`
   from the start** — no retroactive bug fix needed this time, applying
   the STORY-045/046 lesson proactively rather than repeating the
   mistake a third time.

**Testing:** `tests/unit/recipe-qa-lifecycle.test.ts` (44 tests combined
with the moderation-service file below — transition matrix identical in
shape to `qa-lifecycle.test.ts`'s, answer/approve/reject/publish,
`answeredById`/`approvedById` correctly targeting `AdminUser`, real
notification fired on publish). `tests/unit/
recipe-qa-moderation-service.test.ts` — permission gating, separation of
duties (an Edit-only admin can answer but not approve/publish), bulk
moderate with a correctly-skipped non-Answered item, reject reason never
customer-visible (confirmed structurally invisible to
`listPublishedQuestionsForRecipe`), queue listing by status and recipe-
title search. `tests/e2e/admin-recipe-qa.spec.ts` (2 tests — a dedicated
author/reviewer pair, mirroring `admin-qa.spec.ts`'s exact structure:
the author answers and is denied approving their own answer (403,
verified directly against the API), a separate reviewer approves and
publishes, confirmed live on the real recipe detail page; a Viewer-only
fixture can browse but a mutating route denies server-side). Confirmed
zero regressions: all pre-existing Product Q&A tests (`qa-lifecycle`,
`qa-notifications`, `qa-repository`, `qa-service`, `qa-routes`,
`qa-moderation-service`, 78 tests) and Recipe Review tests pass
unchanged, satisfying the spec's explicit "Existing Product Q&A tests
must continue passing." Verified live in the browser as the seeded
Super Administrator: answered a pending recipe question, approved it,
published it, confirmed it live on the real recipe detail page with the
answer text and a real `NotificationLog` row (`status: "Sent"`);
rejected a different question with an internal-only reason and
confirmed it was never shown — then cleaned up all demo data.

**A recurring environmental issue, not a code bug, hit repeatedly this
session:** the local `prisma dev` PGlite server lost all seed data
across several of its wedge-recovery restarts during this story's
verification (confirmed via direct row counts before/after each
restart) — a more severe variant of the already-documented PGlite
wedging issue, since `npx prisma db push` reported "already in sync"
each time despite the data being gone. Recovered each time via a full
reseed (`npx tsx --env-file=.env prisma/seed.ts`). Documented as a
general project lesson (see memory), since it is not specific to this
story's code.

## 2026-10-01 — STORY-071 Customer Group & Pricing Context

Closes the hardcoded-`customerGroup: "Retail"` gap flagged since
STORY-024 and re-confirmed outstanding in the 2026-09-30 deferred-items
review — `User` had no `customerGroup` field, so every `resolvePrice()`
call site passed the literal `"Retail"` regardless of who was actually
asking, even though the pricing engine's customer-group tier has worked
correctly since STORY-009. Pulled ahead of its file position (Epic 06)
in the confirmed build sequence (`docs/blueprint.md` Section 9a) because
STORY-048 (Admin Customers Console) is written to build its UI on top of
the field this story adds.

**A real gap found during research, outside the story's own AC list:**
the AC named exactly 10 call sites (`cart.service.ts` ×4,
`customer-order-history.service.ts` ×1, `product.service.ts` ×4,
`wishlist.service.ts` ×1), but `search.service.ts`'s own `searchProducts`
was calling `resolvePricesForProducts` with **no** `customerGroup` at
all — not even the literal `"Retail"` the AC's list described everywhere
else. STORY-024's own entry had already named `search.service.ts`
alongside the other three as part of the same limitation; the AC simply
dropped it when STORY-071 was written. Fixed in the same pass
(`searchCatalogue`/`searchProducts`, plus their 4 callers) rather than
leaving a known, already-documented gap half-closed — a Wholesale
customer searching for a product would otherwise have seen the correct
price on the PDP and in their cart but the wrong (Retail) price in
search results, undermining the story's own stated goal ("I want my
account's commercial relationship... reflected automatically wherever I
shop").

**Scope decisions:**

1. **One shared resolver** — `pricing.service.ts::resolveCustomerGroupForUser
   (userId: string | null): Promise<CustomerGroup>` — backed by a new,
   deliberately light `user.repository.ts::findCustomerGroupById`
   (selects just the scalar, not `findById`'s full row). Returns
   `"Retail"` for a guest or a row that's unexpectedly missing its
   group — the same default the field itself carries, made explicit so
   every call site shares one source of truth instead of each hardcoding
   the literal independently.
2. **Two different wiring shapes, deliberately kept distinct.**
   `cart.service.ts`/`customer-order-history.service.ts`/
   `wishlist.service.ts` already receive `userId` as a function
   parameter (every one of their 6 combined call sites is reachable only
   from an authenticated or at-least-identified session) — fixed
   entirely internally, resolving the group once per function from the
   `userId` already in scope, no signature or caller changes.
   `product.service.ts`/`search.service.ts`'s functions serve guest
   traffic too and already had (for 3 of 6) an optional
   `customerGroup?: CustomerGroup` parameter nothing populated — kept
   that "caller resolves and passes" shape, added the same optional
   param to the 3 that didn't have it yet (`getProductsByIds`,
   `getProductsForCompare`, and both `search.service.ts` functions
   needed it added fresh), and updated all 13 callers (9 product + 4
   search: pages and API routes) to resolve `auth()` +
   `resolveCustomerGroupForUser` and pass it through.
3. **`getProductDetail`'s new parameter is a plain primitive, not an
   options object, to protect its `cache()` wrapper.** `products/[slug]/
   page.tsx` calls `getProductDetail` through `cache()` from both
   `generateMetadata` and the page body specifically to dedupe the work
   to one call per request (a load-bearing performance optimization,
   per that file's own existing comment). React's `cache()` keys on
   argument equality; a fresh `{ customerGroup }` object literal written
   at each call site would be treated as a different key even when its
   value is identical, silently defeating the dedup and running the
   full PDP aggregation (price resolution, related products, 3 summary
   calls, a category-ancestor walk) twice per page view. Changed the
   signature from `(slug, opts: { customerGroup? })` to `(slug,
   customerGroup?)` — a primitive compares correctly.
4. **Minimal admin path**: `customer-admin.service.ts::setCustomerGroup`
   (new), mirroring `product-admin.service.ts::setCustomerGroupPrice`'s
   `requirePermission`+`writeAuditLog` shape exactly, gated on the
   already-existing `Customers`/`Edit` permission (no seed/schema
   changes — `Customers` already has home-module grants for
   `sales_manager`/`customer_support`). New `PATCH
   /api/admin/customers/[id]/group` — the first route under
   `/api/admin/customers/*`; STORY-048 will extend this directory with
   the full console. Deliberately the only admin-customer capability
   this story ships, per its own "Out of Scope" section.
5. **No new UI to display a customer's own group on their account
   page.** `profile.service.ts::getProfile(userId)` already calls
   `userRepository.findById` with no `select` (the full row, confirmed
   by that file's own "the only place... reads or writes the User row"
   comment) — adding the schema field makes it appear in that response
   automatically, satisfying the AC's "expose the field on whatever
   customer-profile read... already uses" at the data layer. No new
   account-page UI element was added to display it (not explicitly
   asked for — the AC's wording is about the read, not a new
   affordance), avoiding scope creep beyond what the story asks.

**A real test-infrastructure issue found and fixed, not this story's own
bug:** 6 pre-existing route-handler unit tests (`products-route`,
`product-detail-route`, `products-by-ids-route`, `product-compare-route`,
`search-route`, `product-search-route`) directly import their route
module, which now transitively imports `next-auth` via the new `auth()`
call. Under Vitest, loading the real `next-auth` package throws
(`next-auth/lib/env.js` imports `next/server`, which fails to resolve in
Vitest's module graph) — a pre-existing fragility in how this project's
test environment resolves Next.js's package exports, not something
STORY-071 introduced, just the first time code reachable from these
specific 6 test files called `auth()`. Fixed using the established
mitigation already used by `wishlist-route.test.ts`: `vi.mock("@/lib/auth",
() => ({ auth: vi.fn() }))` before importing the route, with the mock
resolving `null` (guest) in a `beforeEach` so each file's existing
guest-only test scenarios keep behaving exactly as before.

**Testing:** `tests/unit/customer-group-pricing.test.ts` (new, 14
tests) — a seeded Wholesale customer with a real `CustomerGroupPrice`
row resolves that tier (not standard) across all 11 call sites: cart
(add item, then read the summary), wishlist, order-history
(`reorderPastOrder`), all 4 `product.service.ts` functions, and both
`search.service.ts` functions — plus confirms every one of them still
defaults to the standard/Retail tier with no group passed.
`tests/unit/customer-admin-service.test.ts` (new, 3 tests) —
`setCustomerGroup` permission-gating, audit log, persistence, and an
unknown-customer rejection. Confirmed zero regressions: the full
pre-existing `cart-service`/`wishlist-service`/
`customer-order-history-service`/`pricing-service`/`product-service`/
`search-service` suites, plus all 6 fixed route tests, pass unchanged
(75+ tests). Verified live in the browser: created a customer, set
their group to Wholesale via the new admin endpoint, signed in as that
customer, and confirmed the real seeded wholesale price (LKR 450, vs.
the Retail LKR 550 struck through) rendered correctly on the PDP, in
the cart, and on the product listing page — then cleaned up the demo
data.

## 2026-10-01 — STORY-047 Admin Orders Console — core scope

Delivers `/admin/orders`: status pipeline, invoices, packing slips,
shipping labels, refunds, and returns. Next in the confirmed build
sequence (blueprint Section 9a) after STORY-071.

**Almost all of the hard infrastructure already existed, reserved by
STORY-028/STORY-036 specifically for this story to consume** —
`order.service.ts::isTransitionAllowed`/`transitionOrderStatus` (already
accepting an `admin:${string}` actor), `OrderStatusHistory` (the full
audit trail already written on every transition),
`payment.service.ts::refundPayment` (full/partial refund already
implemented behind the gateway-agnostic `PaymentProvider` interface,
its own comment anticipating this story), `invoice-pdf.service.tsx`
(a complete `@react-pdf/renderer` template plus the PDF-streaming route
pattern to mirror), `Order.carrier`/`trackingNumber`/`trackingUrl`/
`deliveryZoneName`/`estimatedDaysMin`/`estimatedDaysMax` (already on the
schema since STORY-036, with that model's own comment "admin console
(STORY-047) will" write them), and `ReturnRequest` (STORY-036,
customer-submitted return records, with its own comment deferring
admin-side processing to this story). This story's real scope ended up
being a thin admin orchestration layer, two new PDF templates, one
genuinely new data model, and a modest `ReturnRequest` extension — not
a from-scratch build.

**Scope decisions:**

1. **Reused the real `OrderStatus` pipeline exactly as shipped, not the
   AC's simplified prose.** The AC describes "Pending → Processing →
   Dispatched → Delivered → Returned plus Cancelled." The actual,
   already-tested `ALLOWED_TRANSITIONS` table in `order.service.ts`
   additionally has a distinct `Confirmed` state and allows `Returned`
   from both `Dispatched` and `Delivered`. `order-admin.service.ts`
   calls `isTransitionAllowed`/`transitionOrderStatus` directly — no
   new enum, no new transition table.
2. **`order-admin.service.ts` reuses `order.errors.ts`'s existing error
   classes** (`OrderNotFoundError`, `IllegalOrderTransitionError`,
   `ConcurrentTransitionError`) rather than cloning a parallel
   hierarchy — unlike STORY-045/046's genuinely different sibling
   domains (Review vs. RecipeReview), this operates on the exact same
   `Order` entity as `order.service.ts`. Two new order-level errors were
   added to the same file (`OrderRefundAmountExceedsRemainingError`,
   `OrderHasNoPaymentError`) since they're specific to this story's own
   guards, not reused from elsewhere.
3. **New `RefundRecord` model, not reused `Payment.status`.**
   `Payment.status` (`Pending/Succeeded/Failed/Refunded`) can represent
   only "refunded or not," never an amount, reason, actor, or a log of
   multiple partial refunds. `RefundRecord` (`orderId`, `amount`,
   `reason`, `processedById`, `createdAt`) captures what the AC asks
   for.
   **A real constraint found and documented, not silently worked
   around:** `payment.service.ts::refundPayment` sets `Payment.status =
   "Refunded"` unconditionally after any refund call — even a partial
   one — then refuses a second call (`status !== "Succeeded"` guard).
   So today, only **one** refund action (full or partial) can succeed
   per order, not a running series of partial refunds.
   `order-admin.service.ts::refundOrder`'s own validation (refund
   amount ≤ order total − prior refunds, via
   `refund-record.repository.ts::sumRefundedAmountForOrder`) is still
   written correctly for a future where `refundPayment` supports
   incremental refunds, but a second attempt today fails at the payment
   layer with `PaymentRefundNotAllowedError` — not a bug this story
   introduces, and not patched in STORY-026's gateway-agnostic contract
   without being asked.
4. **Extended `ReturnRequest`, didn't add a parallel `ReturnRecord`.**
   Added `reasonCode ReturnReasonCode?` (new enum:
   `Damaged`/`WrongItem`/`NotAsDescribed`/`ChangedMind`/`Other` — the
   admin's own categorization, distinct from the existing free-text
   `reason`, which is the customer's own words), `processedById`/
   `processedBy` (`AdminUser?`), `processedAt`, `restocked Boolean
   @default(false)`. `order-admin.service.ts::processReturn` completes
   an existing `Requested` `ReturnRequest` when one exists
   (`return-request.repository.ts::findRequestedReturnByOrderId` +
   `completeReturnRequest`), or creates one directly as `Completed` when
   the admin is initiating it themselves with no prior customer request
   (`createCompletedReturnRequest`) — the AC's "lets an admin mark an
   order... as returned," not only "approve a customer's request." On
   completion: optionally restocks (`order.repository.ts::
   restockOrderItems`, reusing the exact increment pattern
   `cancelOrderWithStockRelease` already uses, but scoped to the
   specific selected line items since a return can be partial) and
   transitions the Order to `Returned` via the existing
   `transitionOrderStatus` if it isn't already and the transition is
   legal from the order's current status (if not, the return record and
   restock still succeed — surfaced via `console.warn`, not rolled
   back, since a status-sequencing mismatch shouldn't undo a real
   restock).
5. **Permission gating**, mirroring STORY-045's Edit-vs-Approve split
   for its own money-moving reward grant: `Orders`/`View` for list and
   detail reads; `Orders`/`Edit` for single and bulk status changes;
   `Orders`/`Approve` for refund and return/RMA (both money- or
   stock-moving).
6. **Shipping label is a genuine carrier-agnostic placeholder** — a
   clean A6 PDF (ship-to block, order number, a plain placeholder
   barcode-style text block, "Carrier: not yet integrated" note),
   nothing claiming real carrier tracking, per the AC's own wording and
   blueprint Section 10's unconfirmed-carrier flag.
7. **Packing slip is a genuinely new PDF** mirroring
   `invoice-pdf.service.tsx`'s exact structure/fonts/palette, but shows
   SKU+quantity with checkboxes for warehouse picking, no pricing.
8. **`getOrderAdminDetail`'s return shape (`OrderAdminDetail`) structurally
   extends `OrderDetail`** (`customer-order-history.service.ts`'s
   existing shape) with `customerName`/`customerEmail`/`refundRecords`/
   `returnRequests`/`nextLegalStatuses` — so the exact same
   `renderOrderInvoicePdf(order)` STORY-036 already built is called
   directly from the new admin invoice route, no adapter needed.
   `nextLegalStatuses` (the set of statuses `isTransitionAllowed`
   permits from the order's current status) is computed server-side and
   sent as data — the admin UI's "Mark as X" buttons never need their
   own copy of the transition table, avoiding the drift risk a
   client-side mirror would introduce.

**Testing:** `tests/unit/order-admin-service.test.ts` (new, 14 tests) —
list/detail (including `nextLegalStatuses`), legal and illegal status
transitions against the real state machine, Edit-vs-View permission
gating, bulk status update with a correctly-skipped illegal-transition
item, refund (writes `RefundRecord`, rejects an amount exceeding the
remaining refundable balance, requires Approve not just Edit, rejects a
payment-less order), and return/RMA (admin-initiated with restock and
an `Order.status` transition to `Returned`, completing an existing
customer-submitted `Requested` request instead of creating a duplicate,
Approve-gated). `tests/unit/order-admin-pdf-services.test.ts` (new, 2
tests) — packing-slip and shipping-label PDF smoke tests against a
hand-built fixture, confirming a non-empty `%PDF`-prefixed buffer.
Confirmed zero regressions: `order-service`, `customer-order-history-
service`, `order-routes`, `order-integration-fanout`, and all three
`payment-service` suites pass unchanged (66+ tests).
`tests/e2e/admin-orders.spec.ts` (new, 2 tests) — a full `Confirmed →
Processing → Dispatched → Delivered` walk through the real UI, all
three documents downloading as `application/pdf`, and a partial refund
recorded correctly; a return with restock confirming the order reaches
`Returned` and the product's `stockQuantity` actually increases.
Verified live in the browser against real seeded data: the orders list
renders with live status/payment/total columns, the detail page's
status-action buttons update correctly after each transition, and a
packing-slip download returns a real PDF buffer.

## 2026-10-01 — STORY-048 Admin Customers Console — core scope

Delivers `/admin/customers`: profile, purchase/support/login history,
suspend/activate, manual reward/coupon issuance, internal notes. Next
in the confirmed build sequence (blueprint Section 9a) after STORY-047.
`src/services/customer-admin.service.ts`/`customer-admin.errors.ts`
already existed (STORY-071, deliberately minimal — "the full console
(STORY-048) will likely grow a richer error set") with one function,
`setCustomerGroup`, extended here rather than replaced. This console
mostly composes already-shipped data: `customer-rewards-dashboard.
service.ts::getRewardsSummary`, `customer-referrals-dashboard.
service.ts::getReferralSummary`, `address.repository.ts::
listAddressesByUserId`, `support-ticket.service.ts::listTicketsForUser`,
and `customer-order-history.service.ts::getOrderListPage` all existed
already for the Profile/Rewards/Support/Purchase tabs.
`rewards.service.ts::grantManualPoints` (STORY-045, built for the
review-moderation reward action) was the exact primitive AC #4 needed,
extended with an optional `expiresAt` param rather than duplicated.

**Three genuine gaps found and closed, each a small real addition:**

1. **Suspend/reactivate.** `User.status` already had an `AccountStatus`
   enum (`Active`/`DeactivationRequested`/`Deactivated`) from STORY-034,
   whose own entry above says verbatim: "the `Deactivated` status value
   exists in the `AccountStatus` enum for that future use, unused by
   any code today" — referring to a customer's own deactivation once
   some future admin process enforces it. Conflating that with an
   admin-initiated suspension (fraud/abuse/policy — a different cause)
   would make the two impossible to tell apart in reporting, so a new
   `Suspended` value was added instead, leaving `Deactivated` exactly
   as inert as STORY-034 left it — wiring up self-deactivation
   enforcement is still not this story's job and isn't asked for.
   `User` gained `suspendedReason`/`suspendedAt`/`suspendedById`,
   mirroring the existing `deactivationReason`/`deactivationRequestedAt`
   pair. Login is blocked specifically when `status === "Suspended"` —
   in `auth.service.ts::verifyCredentials`, AFTER the password already
   verified correctly (a deliberate, documented exception to that
   function's own no-enumeration rule: telling a successfully-
   authenticated person their account is suspended reveals nothing an
   attacker could use to enumerate accounts, unlike every other
   failure path there, which stays a uniform `null`). Throws a new
   `AccountSuspendedError`; `src/lib/auth.ts`'s `authorize` catches it
   and re-throws a `CredentialsSignin` subclass
   (`AccountSuspendedSignInError`, `code: "account_suspended"`) so
   `signIn()`'s `result.code` lets `login-form.tsx` show a specific
   message instead of the generic "Incorrect email or password."
   (confirmed via `node_modules/next-auth/react.js` that `result.code`
   is populated from the redirect URL's `code` query param — not
   documented in training data for this Auth.js v5 beta, verified by
   reading the actual runtime source rather than assumed).
2. **Login history.** `AuditLog.actorId` is a FK to `AdminUser` only
   (STORY-038's admin audit trail) and never covered storefront
   customer logins — confirmed by reading the model before assuming
   otherwise. New `LoginEvent` model (`userId`, `success`, `ipAddress`,
   `userAgent`, `createdAt`), written from `verifyCredentials` on every
   outcome once a real user is matched (wrong password AND success) —
   but never for a nonexistent email, so it can't be used to enumerate
   registered addresses either. `@auth/core`'s `Credentials.authorize`
   receives `(credentials, request)` (confirmed by reading
   `node_modules/@auth/core/providers/credentials.d.ts`), threaded
   through to `verifyCredentials` for best-effort IP
   (`x-forwarded-for`) and device (`user-agent`) capture — both null in
   local dev with no reverse proxy, matching the AC's own "where
   available" wording.
3. **Coupon "account-scoped" issuance.** `Coupon` (confirmed by reading
   the full model) had no owner field — `usageLimitPerCustomer` caps
   use per customer but doesn't restrict a code to one customer; a
   random code alone would be security-through-obscurity, not an
   enforced restriction. `referral.service.ts`'s own comment had
   already flagged this exact gap before this story existed to close
   it: "coupon.repository.ts has no function to programmatically create
   a new Coupon row... building one is separate scope." Added
   `Coupon.restrictedToUserId String?` and one check in
   `coupon.service.ts::validateCoupon` — a restricted coupon redeemed
   by anyone else throws `CouponNotFoundError` (not a distinct
   "forbidden"), matching this app's no-enumeration precedent.
   `coupon.service.ts::issueCouponToCustomer` generates an 8-character
   Crockford-base32 code (same alphabet/retry-on-collision pattern as
   `order.service.ts::generateOrderNumber`/`referral.service.ts::
   generateCode` — same "unambiguous read aloud" rationale applies to a
   support agent reading a code to a customer), sets
   `usageLimitGlobal`/`usageLimitPerCustomer` both from the single
   `usageLimit` param (the AC's "single-use or account-scoped" maps to
   `usageLimit: 1` vs. a higher number — both are already
   account-restricted via `restrictedToUserId`, so no separate "scope"
   toggle was needed). General-purpose coupon CRUD (a Marketing
   console) is still a future story; this is only ever a single
   customer-restricted grant.

**A real security issue found and fixed while composing the detail
read, not introduced by this story alone (STORY-071's `setCustomerGroup`
had the same gap already):** `userRepository.findById`/
`listCustomersForAdmin`/etc. return the full `User` row, including
`passwordHash`. Every admin-customer read now goes through a new
`toCustomerAdminSummary` mapper in `customer-admin.service.ts` before
reaching a route response — applied to `listCustomersForAdmin`,
`getCustomerAdminDetail`, `suspendCustomer`, `reactivateCustomer`, and
retrofitted onto `setCustomerGroup`'s own return value.

**Dropped, not built: the AC's "tags" filter.** No backing concept for
customer tags exists anywhere in this codebase (confirmed by
searching) — same "don't invent a feature the data model has no room
for" judgment call as STORY-047's already-satisfied delivery-zone
finding. List filtering ships with status/search/registration-date
only.

**Internal notes never reach a customer-facing read.** `AdminNote` has
no relation from, and is never selected by, any customer-facing
service (`profile.service.ts`, `customer-dashboard.service.ts`, etc.)
— structural non-visibility, not merely a missing UI affordance.
Confirmed via `profile-service.test.ts`'s existing `getProfile` call
never returning an `adminNotes` field.

**Testing:** `tests/unit/customer-admin-service.test.ts` (extended from
STORY-071's 3 tests to 14) — list/detail with the passwordHash-leak
guard, suspend blocking a real `verifyCredentials` call (not just the
DB flag), reactivate restoring it, double-suspend and
reactivate-when-not-suspended rejected, View/Edit/Approve permission
gating, a LoginEvent-writing test (success, wrong password, and
nothing for a nonexistent email), grant-reward reflected in
`getRewardsSummary`, issue-coupon redeemable by that customer and
`CouponNotFoundError` for a different one, and a note's absence from
`getProfile`. Confirmed zero regressions: `auth-service`,
`admin-auth-service`, `profile-service`, `rewards-service`,
`review-moderation-service`, `coupon-service`, `coupon-routes`, and
`customer-order-history-service` suites pass unchanged (103 tests,
run individually per this session's established PGlite-under-load
recovery discipline). `tests/e2e/admin-customers.spec.ts` (new, 2
tests) — a suspend/reactivate walk confirming the real storefront
login form shows the specific suspended message and blocks/un-blocks
sign-in (in a separate browser context from the admin session, to
avoid cookie cross-contamination between the two auth boundaries on
one page), and a reward-grant + coupon-issuance walk confirming the
balance updates in the UI and the issued coupon's `usageLimitGlobal`/
`usageLimitPerCustomer` are both set to the requested limit. Verified
live in the browser: suspended a real seeded customer, confirmed their
storefront login was blocked with the specific message, reactivated,
confirmed login worked again.

## 2026-10-02 — STORY-049 Rewards & Referrals Campaign Management — core scope

Delivers the admin configuration surface for the Rewards/Loyalty Club
(STORY-030) and Referral Programme (STORY-031): campaign builder, point
rule configuration, tier/badge management, referral rule configuration,
and a fraud-monitoring review queue. Blueprint Section 9a's own note on
this story: "what STORY-045's manual reward grant (built ahead of this
story) will eventually integrate with" — confirmed manual grants
(`rewards.service.ts::grantManualPoints`, used by STORY-045's review
reward and STORY-048's manual customer grant) stay independent of
campaigns; nothing here retrofits them.

**Several pieces already existed as reserved-but-unwired config,
explicitly flagged in earlier stories' own comments for this story to
pick up:** `RewardSetting` (`pointsToCurrencyRate`,
`maxRedeemablePointsPerOrder`, `pointsExpiryDays`,
`orderValuePointsRate`) and `ReferralSetting`
(`referrerBonusPoints`/`minQualifyingOrderValue`/
`attributionWindowDays`/`referredWelcomeBonusPoints`) were both already
read by their respective services — only `orderValuePointsRate` was
unread, its own schema comment calling out "reserved for a future
order-value-based earning mode," and STORY-030's own architecture-
decisions entry said building that logic "without a concrete admin UI
to configure it would be speculative." `RewardTier`/`Badge` (STORY-030)
were already read by `evaluateTierAndBadges`. None of these four had a
write/CRUD path — this story adds exactly that, no new models for any
of them. Self-referral exclusion already existed
(`referral.service.ts::attributeReferralAtRegistration`, exact email
match → `ReferralAttribution.status = "Excluded"`); the new fraud
heuristics below reuse that same model and its already-extensible
`excludedReason` string convention, not a parallel concept.

**1. Campaign multiplier — new `RewardCampaign` model, one integration
point.** Points are earned from `Product.rewardPoints * quantity`,
computed inside `cart.service.ts::buildSummary` — the same function
that already resolves `customerGroup` (STORY-071) and calls
`resolveDiscountForCart` once per cart read for coupons/promotions
(STORY-029). `reward-campaign.service.ts::resolveActiveMultiplier(
customerGroup, now)` is called the same way: once per cart read,
applied to every line's `rewardPointsEarned` via `toLineItem`'s new
`campaignMultiplier` parameter. `RewardCampaign.targetCustomerGroup`
is nullable — null means all groups, reusing STORY-071's existing
segmentation concept rather than inventing a parallel one. More than
one active, matching campaign: the highest multiplier wins (a simple,
explainable tie-break). Confirmed `checkout.service.ts::placeOrder`
re-reads the cart via `getCartForCheckout`→`buildSummary` immediately
before order creation — the exact same re-validation path coupons
already go through — so this one change covers both the live cart
preview and the order snapshot with no separate wiring and no
stale-multiplier risk between viewing a cart and placing the order.

**2. `orderValuePointsRate` is wired in as an additive bonus, not a
replacement mode.** `Math.floor(subtotal * rate)` points are added to
the cart-level `rewardPointsEarned` total, on top of the per-product
sum — the existing, shipped, tested per-product mechanism is
untouched. STORY-030 explicitly deferred building dual-mode
earning-formula *selection* logic as speculative without a concrete
admin UI; additive avoids that decision entirely while finally letting
the reserved field do something once this story's UI exists to set it.

**3. Fraud monitoring is genuinely new infrastructure — a new
`FraudFlag` model and `fraud-detection.service.ts`, built around real,
scoped heuristics against data that already exists, never blocking the
customer action that triggers them** (mirrors this codebase's
established "never block the primary action on a side-effect check"
precedent — STORY-034's address-save-during-checkout,
STORY-031's referral attribution itself):
- **Shared address** is checked at the referral's *qualifying* step
  (`handleQualifyingCheck`, when the referred customer's order
  confirms), not at registration — a brand-new customer almost never
  has a saved address yet, so checking there would rarely find
  anything. By qualification time there's a real order with a real
  shipping address (`Order.shipLine1`/`shipCity`) to compare against
  the referrer's own saved `Address` book. This is a deliberate
  refinement of the original plan (which proposed checking at
  registration) made during implementation once the data-availability
  gap was clear.
- **Referral velocity** (`ReferralSetting.maxReferralsPerPeriod` +
  `referralPeriodDays`, two new nullable fields, same "both unset =
  off" convention every other setting field here uses) is checked at
  attribution creation (registration) — independent of any order.
- **Redemption velocity** is checked after a successful order redeems
  points, against a fixed window/threshold (7 days / 2000 points), not
  an admin-configurable setting — the AC asks for a referral
  fraud-threshold specifically, not a separate redemption one.
- **"Shared payment method" from the AC is explicitly not
  implemented** — the payment gateway is still "mock," with no real
  card data to fingerprint (blueprint Section 10's unconfirmed-
  provider flag, the same one STORY-026/047 already established).
  Documented as deferred, not silently dropped or guessed at. All
  three implemented heuristics, plus this deferred one, are the
  concrete candidates for future AI-assisted scoring (STORY-064) per
  the AC's own wording.
- **Reversal** claws back the flagged reward via a new, generic
  `rewards.service.ts::reverseTransaction(transactionId, note)` —
  writes the matching `Reversed`/`ReferralBonusReversed` row, mirroring
  exactly how `reversePointsForCancelledOrder` already claws back an
  order-cancellation's `Earned` row. Only `Earned`/`ReferralBonus`
  transactions are reversible (`RewardsTransactionNotReversibleError`)
  — reversing a `Redeemed` row would mean refunding points a customer
  already spent on a real order, a different operation this story
  doesn't attempt.

**Permission gating** mirrors STORY-045/047/048's Edit-vs-Approve
split: `RewardsReferrals`/`View` for every read; `/Edit` for
campaign/setting/tier/badge CRUD; `/Approve` for fraud-flag
resolution (reversing is money-moving, same bar as STORY-047's refund
and STORY-048's reward grant).

**Testing:** `tests/unit/reward-campaign-service.test.ts` (9 tests) —
multiplier resolution by group/date range/highest-wins, and a real
`cart.service.ts::buildSummary`-level test (via `addItem`/`getCart`)
confirming a cart's `rewardPointsEarned` actually doubles with an
active campaign — not just that the resolver function returns the
right number in isolation. `tests/unit/rewards-admin-service.test.ts`
(4 tests) — setting update reflected in a cart's additive bonus, tier/
badge CRUD, permission gating. `tests/unit/referral-admin-service.test.ts`
(2 tests) — setting update including the new fraud-threshold fields.
`tests/unit/fraud-detection-service.test.ts` (11 tests) — each
heuristic's trigger/non-trigger condition, approve (no reward change)
vs. reverse (real points clawback via `reverseTransaction`, confirmed
against the customer's actual balance), not-found/not-pending
rejections, permission gating. Confirmed zero regressions:
`cart-service`, `cart-routes`, `checkout-service`, `checkout-routes`,
`rewards-service`, `rewards-routes`, `referral-service`,
`referral-routes` suites pass unchanged (102 tests) — significant
given this story edits `buildSummary`/`attributeReferralAtRegistration`/
`placeOrder` directly. `tests/e2e/admin-rewards-referrals.spec.ts` (2
tests) — creating a 2x campaign via the real admin UI doubles a real
guest cart's `rewardPointsEarned`, verified by reading the actual
`/api/cart` route before and after (not a mocked check); reversing a
fraud flag from the real Fraud Queue UI claws back the related
`RewardTransaction`'s points, confirmed against the database. Verified
live in the browser via the same e2e flows.

## 2026-10-02 — STORY-050a Promotional Pop-up Manager — core scope

The first of five sub-stories STORY-050 (Marketing Console) was split
into, confirmed with the user — Popups first, since it's the most
self-contained spec, detailed separately in `docs/stories/07-enterprise-
admin-platform/STORY-Additional.md` §3–9 ("PROJECT CINNAMON — ADMIN CMS
ENHANCEMENT"). The split itself and the remaining four sub-stories'
order are recorded in `docs/blueprint.md` Section 9a.

That source document's own section 14 instruction — "inspect the
existing CMS models... RBAC... audit logging... analytics... customer
segmentation... identify reusable patterns... do NOT create duplicate
systems" — was followed literally before writing any code:

**Reused, not rebuilt:** `AdminModule.Marketing` and the plain `View`/
`Edit`/`Approve` `AdminAction` shape every other admin console this
session built already uses — **not** the granular `PROMOTION_VIEW`/
`CREATE`/`EDIT`/`PUBLISH`/`PAUSE`/`ARCHIVE` scheme that source doc's own
section 12 suggests. Introducing a second, finer-grained permission
model alongside the one every other console already uses would itself
be the "competing system" that doc's own section 15 explicitly forbids.
`Edit` gates content/scheduling and low-risk status moves (pause,
archive); `Approve` gates whatever makes a popup live or takes it down
(publish, and resuming into Published from Paused; unpublish) — the
same money/visibility-moving bar STORY-047's refund and STORY-048's
reward grant already established. `AssetPickerDialog`/`MediaAsset`
(STORY-041) is reused directly for the image/mobile-image fields —
confirmed via that component's own doc comment that it's "the only
sanctioned way other admin modules select an image/video/document."
`CustomerGroup` (STORY-071) is reused for audience segmentation exactly
as `RewardCampaign` (STORY-049) already reused it. `Dialog` (`@/
components/ui/dialog`) is already used on the storefront side too
(confirmed: `address-form-dialog.tsx`, `redeem-points-dialog.tsx`), so
the popup's live render reuses it rather than a new overlay primitive.

**Two real gaps, each scoped honestly rather than over-built:**
1. **No page-targeting system exists to reuse.** `Promotion`
   (STORY-029) only scopes to products/categories, never pages — a new
   `PopupPageTarget` enum (`AllPages`/`Homepage`/`Products`/`Recipes`/
   `Blog`) is grounded in this app's actual storefront route groups,
   confirmed by listing `src/app/(storefront)`, not invented.
2. **No visitor/session-tracking infrastructure exists at all** —
   confirmed by the admin dashboard's own "Live Visitors: Coming soon —
   storefront session tracking isn't built yet" widget (STORY-039).
   This honestly bounds two AC bullets, both stated plainly in the
   admin UI's own copy rather than silently overstated as equally
   solid: **new-vs-returning-visitor targeting** resolves as "don't
   exclude either way" server-side (there's no visitor identity to
   check against) — a real cookie-based heuristic was deliberately not
   built for v1, since it would only ever be a guess masquerading as a
   targeting rule; **frequency capping** gets real, server-side
   enforcement only for *authenticated* customers (the new
   `PopupInteraction` ledger, keyed by `userId`) — guests get
   `OncePerSession` capping via `sessionStorage` only, since there is
   no guest-identity architecture to enforce the other caps
   (`OncePerDay`/`Week`/`Customer`/`UntilDismissed`) against server-side.

**A deliberate refinement made during implementation, not in the
original plan:** page-view counting (the `PageViews` trigger) uses a
`sessionStorage` counter bumped on every client-side page mount —
confirmed working correctly with the trigger-controller's `key=
{pathname}` remount pattern (see below), not a separate tracking system.

**`PopupInteraction` serves two AC bullets at once, deliberately** —
per the source doc's own section 11 instruction ("do not introduce a
second analytics architecture"): the authenticated frequency-cap check
above, *and* the admin editor's performance summary (impressions/
clicks/dismissals). One model, not two.

**The eligibility/trigger split**, mirroring `reward-campaign.service.ts
::resolveActiveMultiplier`'s (STORY-049) "resolve once, pure function
over pre-fetched state" shape: `popup.service.ts::resolveEligiblePopup`
(server) decides *which* popup, if any, is eligible at all (page,
audience, schedule, status, authenticated-frequency-cap); the client
(`popup-trigger-controller.tsx`) owns the trigger's own *timing*
(delay/scroll/exit-intent/page-views/add-to-cart/before-checkout are
inherently client-observed events). `AddToCart` is wired to a real
event (`window.dispatchEvent(new Event("oristor:add-to-cart"))`) added
to `use-cart.ts`'s `addItemMutation.onSuccess` — the one shared choke
point every "add to cart" action in the app already goes through
(confirmed by finding both of its consumers, `use-add-to-cart.ts` and
`wishlist-item-row.tsx`), so no product/cart UI component needed its
own popup awareness. `BeforeCheckout` is resolved by checking
`pathname.startsWith("/checkout")` directly in the controller, rather
than a new `PopupPageTarget` enum value, since it's semantically a
*trigger moment*, not a *page category*.

**`couponCode` is a display-only string field, not validated against
the real `Coupon` model** — that live integration is explicitly
STORY-050b's job (coupon management UI) once it exists, a deliberate
scope boundary stated in the field's own schema comment, not an
oversight.

**A `key={pathname}` remount pattern replaced an initial draft that
reset state imperatively inside a `useEffect`** (caught by this
project's `react-hooks/set-state-in-effect` lint rule) — `
PopupTriggerController` is now a thin wrapper rendering `
<PopupTriggerForPage key={pathname} .../>`, giving every navigation a
fresh component instance instead of manually clearing state on every
pathname change.

**Testing:** `tests/unit/popup-service.test.ts` (16 tests) — admin
CRUD + audit logging, the full status-transition table (Edit-gated
moves succeed for an Edit-only admin, Approve-gated moves correctly
rejected for the same admin, an illegal transition like Archived→
Published rejected), a real performance-summary count,
`resolveEligiblePopup`'s page-target matching, schedule-window
boundaries, every audience-target heuristic (`CustomerGroupTarget`,
`Authenticated`, `LoyaltyMembers` via a real `RewardTransaction`,
`ReferralMembers` via a real `ReferralAttribution`), an authenticated
customer's frequency cap actually blocking re-eligibility via real
`PopupInteraction` rows (not mocked), and the variant-group weighted
pick confirmed to only ever return one of its siblings across repeated
calls. `tests/unit/use-cart.test.tsx` (existing, 4 tests) confirmed
unchanged after adding the `AddToCart` event dispatch.
`tests/e2e/admin-popups.spec.ts` (1 test, covering the full workflow)
— a View/Edit-only admin's publish attempt is rejected server-side
(403, confirmed via that admin's own separate browser context, not
just a hidden button); the full-access admin creates and publishes a
real popup through the real editor UI; a separate, real storefront
visitor (a third browser context) sees it render on the real homepage
with a real `Immediate` trigger, a real `Impression` row is written;
dismissing it and reloading confirms the `OncePerSession` cap actually
prevents a second showing within the same session, and a real
`Dismissal` row is written. Verified live in the browser via the same
flow.

## 2026-10-02 — STORY-050b Coupon & Promotion Management UI

The second of five STORY-050 (Marketing Console) sub-stories, after
STORY-050a (Promotional Pop-up Manager). Unlike that story, this one
has **no genuine capability gap** — `Coupon`/`Promotion` (STORY-029)
and `discount.service.ts`'s `couponToRule`/`promotionToRule` (read
live at checkout) already fully support every AC bullet. This story
is purely the missing admin surface: `/admin/marketing/coupons`
(Coupons / Promotions tabs), confirmed working end-to-end by applying
an admin-created coupon to a real cart in both the unit test and the
e2e test, not just saving it.

**`coupon.repository.ts::createCoupon`'s input shape was extended, not
duplicated**, so STORY-048's customer-admin single-coupon issuance
(`coupon.service.ts::issueCouponToCustomer`) and this story's
general-purpose admin create both go through the one function — the
new fields (`scope`, `minOrderValue`, `stackable`, `scopeProductIds`,
`scopeCategoryIds`) default to STORY-048's exact prior behavior
(`AllProducts`, no minimum, non-stackable, no scope rows) when omitted.

**A STORY-048-issued, customer-restricted coupon (`restrictedToUserId`
set) is deliberately excluded from this console's list and from
`getCouponAdminDetail`** (`CouponAdminNotFoundError`, not a silent
empty result) — it's managed from the Customers console, and showing
or letting it be edited here would blur who owns that one-off grant.

**A real latent bug was found and fixed while testing this story, not
introduced by it**: `coupon.service.ts::isUniqueCodeViolation` (written
for STORY-048's generated-code retry loop) checked `error.meta.target`
for a P2002 unique-constraint violation — the classic Prisma shape.
Under this project's actual `@prisma/adapter-pg` driver adapter
(Prisma 7), `meta.target` is **not populated**; the violated column
list instead lives at `meta.driverAdapterError.cause.constraint.fields`
(confirmed by triggering a real duplicate-key insert and inspecting the
thrown error — see the function's updated comment). STORY-048's retry
loop never surfaced this, since its randomly-generated 8-character
codes essentially never collide in practice; this story's
duplicate-admin-code test is what actually exercises the catch path
for the first time. Fixed by checking both shapes, so this keeps
working if Prisma ever reverts/standardizes it.

**Permission gating is `View`/`Edit` only, no `Approve` tier** — unlike
a popup's publish step (STORY-050a), a coupon/promotion has had no
distinct "make it live" action beyond `isActive` + its own date range
since STORY-029, so introducing an approval gate here would be new
process, not a reflection of how the model already works.

**The scope-product picker (`coupon-scope-product-picker.tsx`) reuses
the admin products search endpoint** (STORY-040,
`/api/admin/products`), the same dependency
`recipe-ingredient-product-picker.tsx` (STORY-043) already has for its
own single-select variant — which means an admin needs **both**
`Marketing:Edit` and `Products:View` to use it. This cross-module
permission dependency already existed via the recipe picker; this
story's e2e test is the first to actually exercise it (and so the
first to need the explicit `Products:View` grant on its test admin).

**Testing:** `tests/unit/coupon-admin-service.test.ts` — permission
gating, CRUD + audit logging for both models, the duplicate-code
rejection (and the `isUniqueCodeViolation` fix above), the restricted-
coupon list/detail exclusion, and — the key proof this story is wired
in, not just persisted — a real admin-created, product-scoped coupon
applied to a real cart via `applyCouponToCart`: accepted for a matching
product, rejected with the real `CouponScopeNotMetError` for a
non-matching one. `tests/e2e/admin-coupons.spec.ts` repeats that same
proof end-to-end through the real admin UI and the real storefront
cart page. Regression: `coupon-service`, `coupon-routes`,
`checkout-service`, `checkout-routes`, `cart-service` (83 tests) —
confirmed unaffected, since `discount.service.ts`'s read side was never
touched by this story.

## 2026-10-02 — STORY-050d Email/SMS/WhatsApp Campaign Builder

The fourth of five STORY-050 (Marketing Console) sub-stories — 050c
(Seasonal campaign hub) explicitly depends on this and 050e existing
first, so this landed before it.

**The one real architectural fork, surfaced to the user before
planning, not guessed at**: "schedule for later" needs something to
actually fire the send — unlike every other "Scheduled" feature in
this codebase (blog posts — `blog-post-status.ts::deriveEffectiveStatus`,
popups — `findEligiblePopups`'s date-range check, promotions), which
are all lazily evaluated at read time, nobody's page load triggers an
outbound SMS/email blast. This codebase has no cron/background-job
infrastructure anywhere, and hosting/cloud provider is still an open
item (`docs/blueprint.md` Section 10) — the thing a real cron would
run on. **Resolved with the user: no new infrastructure.** A campaign
is sent immediately ("Send now") or left `Scheduled` with a
`scheduledAt`; a separate, `Approve`-gated action — "Send due
campaigns" — actually dispatches every past-due `Scheduled` campaign
when an admin triggers it. True unattended automation is deferred to
once hosting is confirmed, not faked here.

**Everything else is reuse, not new architecture:**
- `notification.service.ts`'s provider cache (`getProviderForChannel`)
  and `renderTemplate`'s `{{key}}` substitution (now exported) are used
  directly — no second provider or templating mechanism for bulk sends.
- **`NotificationLog` is the one delivery ledger for both transactional
  and campaign sends** — a synthetic `templateKey: "campaign:{id}"` +
  `triggeringEventId: campaignId` gets per-campaign, per-recipient,
  per-channel idempotency for free via that model's own existing
  `@@unique([triggeringEventId, templateKey, channel, recipient])`:
  re-running "Send due campaigns", or a recipient matching two
  overlapping segments, can never double-send. Confirmed by a real
  test (`sending the same campaign twice never double-sends`), not
  just asserted. The same ledger backs the AC's delivery-status
  tracking via a `groupBy` summary
  (`notification.repository.ts::getDeliverySummaryByTriggeringEventId`)
  — the same "one ledger, two jobs" principle STORY-050a's
  `PopupInteraction` already established.
- `notification.service.ts::sendToChannel`'s provider-call + log-write
  step was extracted into a shared `dispatchAndLog` helper, used by
  both the existing transactional path and the new exported
  `sendCampaignMessage` — campaign sends skip
  `resolveChannelTargets`/`NotificationTemplate` entirely (a fixed
  system `templateKey` doesn't fit an admin's ad-hoc per-campaign
  content), but still go through the same provider cache and log
  table. The transactional path's own behavior is unchanged — confirmed
  by re-running the full existing `notification-service`/
  `notification-routes`/`qa-notifications` suites (22 tests) after the
  refactor.
- **Consent is channel-specific and already modeled, not invented**:
  Email marketing gates on `User.marketingOptIn` — confirmed via that
  field's own schema comment ("STORY-034's 'promotional emails'
  toggle... same concept already captured at registration") — **not**
  `NotificationPreference.emailOptIn`, which is order-lifecycle only
  and would have silently opted every transactional-email customer
  into marketing blasts too. SMS/WhatsApp reuse the existing
  channel-level `smsOptIn`/`whatsappOptIn` + a phone on file, since no
  separate marketing-specific toggle for those channels has ever
  existed or been needed.
- `CustomerGroup` backs one audience segment (`CustomerGroupTarget`);
  `RewardTransaction`/`ReferralAttribution` back two more
  (`LoyaltyMembers`/`ReferralMembers`), resolved in bulk with the exact
  same semantics `popup.service.ts::matchesAudience` already
  established per-user — `listLoyaltyMemberUserIds` is the bulk form
  of `rewards.repository.ts::getBalances`'s `lifetimeAchievement`
  calculation (sum of `Earned`/`Reversed` points, kept only where
  positive), not a new definition.
- A new `CampaignAudienceTarget` enum (not a reuse of
  `PopupAudienceTarget`) — a bulk send has no guest/anonymous
  recipient, so popup-only values (`NewVisitors`, `Authenticated`,
  etc.) don't apply; forcing a shared enum would carry meaningless
  values on every row.

**Permission split** mirrors every other admin console this session
built: `Marketing`/`Edit` for draft content/schedule;
`Marketing`/`Approve` specifically for `sendCampaignNow` and
`processDueCampaigns` — the same money/visibility-moving bar as
STORY-047's refund and STORY-050a's publish, since dispatching a bulk
blast to real customers is a clearly separate, irreversible action
(unlike STORY-050b's coupons, which have no distinct "go live" step).

**A real test-fixture bug found and fixed while writing the unit
tests** (not a product bug): the first draft of
`email-sms-campaign-service.test.ts` gave every seeded test customer
the identical placeholder phone number. Since `NotificationLog`'s
dedup key is keyed on `recipient` (the phone/email string), not
`userId`, two different customers sharing one phone number correctly
collapsed into a single log entry — the dedup logic did exactly its
job, but it caught an unrealistic test fixture rather than a real
bug. Fixed by giving each seeded test customer a unique phone number.
Documented here because the same sharp edge would bite a real deploy
if two distinct customer accounts legitimately shared a phone number
(e.g. a household) — a second campaign send to that number would be
silently treated as already-delivered. Out of scope to address further
this pass; noted for whoever next touches multi-account shared-contact
handling.

**Testing:** `tests/unit/email-sms-campaign-service.test.ts` (14
tests) — permission gating, all four audience segments resolved
against real seeded users/`RewardTransaction`/`ReferralAttribution`
rows, consent/contact filtering, real `NotificationLog` rows with
correct dedup, `processDueCampaigns` only picking up past-due
`Scheduled` rows (not `Draft`, not future-dated), merge-field
rendering, and edit-blocked-once-`Sent`. Regression:
`notification-service`/`notification-routes`/`qa-notifications` (22
tests) confirm the `sendToChannel` refactor changed no transactional
behavior. `tests/e2e/admin-email-sms-campaigns.spec.ts` — an admin
creates and sends a real SMS campaign scoped to a customer group
through the real console; a real seeded customer in that group with
`smsOptIn` + a phone receives a `Sent` `NotificationLog` row, a
customer outside the group does not.

## 2026-10-02 — STORY-050e Landing Page Builder

The last of the three STORY-050 (Marketing Console) sub-stories that
STORY-050c (Seasonal campaign hub) depends on — 050a (Popups) and 050b
(Coupons/Promotions) were already merged; 050d (Email/SMS/WhatsApp)
merged immediately before this. Once this lands, 050c becomes
buildable.

**The one real scoping question, surfaced to and resolved with the
user before implementation**: the AC asks this builder to reuse
STORY-042's "section component library," but reading every one of
Homepage's 11 section types (`homepage-sections.tsx`) in full showed
only **Hero Banner** is genuinely admin-authored, reusable content —
the other 10 (Best Selling Products, Why Choose Oristor, etc.) just
toggle visibility/title over hardcoded sitewide fixture data
(`lib/fixtures/home-fixtures.ts`), not real content a one-off campaign
page could embed. **Resolved with the user**: a landing page is an
ordered stack of Hero-Banner-shaped blocks — the first acts as the
hero, additional ones are the AC's "content blocks" — reusing
`hero-banner-slide.tsx`'s render component directly (confirmed by
reading it in full: a pure, presentation-only component taking a
plain data interface, zero DB coupling). The other 10 section types
stay homepage-only; forcing them into a landing-page context would
have meant either showing identical sitewide content on every
campaign page or re-engineering their content model — both outside
this story's actual scope.

**New `LandingPage`/`LandingPageBlock` models, not a reuse of
`HomepageLayout`/`HomepageSection`/`HeroBannerSlide`** — those are
hard-wired to a single, site-wide active homepage
(`homepage-builder.service.ts` enforces exactly one `Published` layout
at a time). Many landing pages are independently live at once, a
materially different invariant despite similarly-named statuses.
`LandingPageBlock`'s fields mirror `HeroBannerSlide`'s exactly; only
the render *component* is reused, never duplicated. For the same
reason, `LandingPageStatus` is a new enum (even though its three
values echo `HomepageLayoutStatus`) — forcing a shared Prisma enum
across two features with different "how many can be live" rules would
wrongly couple them. `LandingPageBlock.alignment` **does** reuse the
existing `ContentAlignment` enum directly, since that one is genuinely
generic (already shared by `HeroBannerSlide` itself).

**Status workflow reuses STORY-050a's exact Edit/Approve split**:
`Edit` gates the low-risk direction (`Draft`/`Published` → `Archived`,
`Archived` → `Draft`); `Approve` gates whatever makes a page publicly
reachable (`Draft`/`Archived` → `Published`) — the same money/
visibility-moving bar this session has used consistently. Unlike
Homepage's single-active-layout model, there's no "swap + rollback" —
editing a `Published` page just edits it in place, and retiring one is
a plain `Archived` transition.

**The public route (`/landing/[slug]`) follows `/recipes/[slug]`'s
exact shape** (`generateMetadata` + `notFound()` + a direct
`landing-page.service.ts` call, no internal API round-trip, confirmed
by reading that file) — a `Draft`/`Archived` page's slug simply 404s
for a public visitor (the repository's own `findPublishedLandingPageBySlug`
filters to `status: "Published"`, so there's nothing to leak via direct
slug guessing). SEO fields (`metaTitle`/`metaDescription`) are
first-class per CLAUDE.md's "Accessibility & SEO are not optional,"
falling back to the first block's `supportingText`/`subheadline` when
left blank — the page is left indexable by default (no blanket
`noindex`), since a campaign landing page is meant to drive traffic,
not hide from it.

**A real admin-UX bug caught before it shipped, not discovered via a
failing test**: the first draft of "Add block" created a block via the
API with an empty `desktopImageUrl`/`desktopImageAlt` (matching
`HeroBannerSlide`'s own non-nullable fields), which the validation
schema correctly rejects — every "Add block" click would have failed
immediately. Fixed by restructuring the flow so a block is never
created until the admin has actually picked a real image (the Media
Library's own `AssetPickerDialog`, opened directly by "Add block");
confirmed the picker's server-side `selectAssetForPicker` gate
(`media.service.ts`) already guarantees a selected asset always has
non-empty alt text, so no placeholder/fallback alt text was ever
needed.

**Testing:** `tests/unit/landing-page-service.test.ts` (10 tests) —
CRUD + audit logging, slug-uniqueness rejection, block CRUD +
reordering, the full status-transition table (Edit vs. Approve,
illegal transitions rejected), and `getPublishedLandingPageBySlug`
proven to return nothing for a `Draft`/`Archived` page and the real
visible blocks in the right order for a `Published` one. Regression:
`homepage-builder-service` (12 tests) confirms `hero-banner-slide.tsx`
and `homepage-builder.service.ts` are unaffected, since this story only
reads/imports the former and never touches the latter.
`tests/e2e/admin-landing-pages.spec.ts` — a View/Edit-only admin's
publish attempt is rejected server-side (403, via a separate browser
context); the full-access admin builds a real page (name, slug, one
block with a real Media Library image) through the real console,
publishes it, and a separate, real storefront visitor sees it render
at `/landing/<slug>` with the real headline and CTA; a second,
unpublished page's slug confirmed 404ing for that same visitor.

## 2026-10-02 — STORY-050c Seasonal Campaign Hub

The last of the five STORY-050 sub-stories, built only once 050a
(Popups), 050b (Coupons/Promotions), 050d (Email/SMS/WhatsApp), and
050e (Landing Pages) all existed — the AC's own framing ("tie together
a coupon, a popup, a homepage section override, and an email/SMS/
WhatsApp send") makes it a pure linking + reporting record over
already-built pieces, not a new orchestration layer.

**The one real scope decision**: `SeasonalCampaign`'s own status
(`Draft`/`Scheduled`/`Active`/`Ended`/`Archived`) does **not** cascade
into any linked entity's own status — marking a hub "Active" never
force-publishes a `Draft` popup, and "Ended" never unpublishes one.
The admin still manages each linked item's own lifecycle in its own
console (Popups, Coupons, Email/SMS); this hub only groups up to four
already-created items under one name and date range and reports their
combined performance. Building cross-entity cascade automation would
have meant inventing surprising side effects (what should "Active"
actually *do* to a Draft popup — publish it? refuse to activate the
hub?) that neither the AC nor the user asked for. `SeasonalCampaign`
only links to pre-existing rows via four nullable foreign keys
(`popupId`/`couponId`/`emailSmsCampaignId`/`homepageSectionId`, every
one `onDelete: SetNull`) — it never creates a popup/coupon/campaign
itself.

**New `SeasonalCampaignStatus` enum, not a reuse of any sibling
status enum** — `Active`/`Ended` are new terms (none of `PopupStatus`,
`LandingPageStatus`, or `CampaignStatus` has them), matching the AC's
own literal wording for this entity. Status transitions reuse STORY-
050a's exact Edit/Approve split: `Draft → Scheduled` and anything
`→ Archived` are `Edit`-gated (low-risk); `Scheduled → Active` and
`Active → Ended` are `Approve`-gated (the same "whatever makes it
live or takes it down" bar every other admin console this epic built
uses).

**Performance summary is a per-channel breakdown, not one blended
number** — a popup's impressions/clicks/dismissals, a coupon's
redemption count, and an email/SMS campaign's sent/failed/skipped
counts aren't comparable quantities, so forcing them into a single
"performance score" would be misleading. `getSeasonalCampaignPerformanceSummary`
simply fans out to each linked item's own existing performance read
(`popup.service.ts::getPerformanceSummary`,
`email-sms-campaign.service.ts::getCampaignDeliverySummary`) plus one
new, trivial `CouponRedemption` count query — no second analytics
system, same principle `PopupInteraction`'s own doc comment states.

**Homepage section picker is a deliberate two-round-trip client-side
read, not a new admin endpoint** — confirmed by reading
`homepage-builder.service.ts` in full: `findPublishedLayout` (the only
function that reads the live layout's sections without needing a
layout id first) is wired exclusively to the unauthenticated storefront
read (`homepage.service.ts`), not exposed to the admin API at all.
Rather than adding a permission-gated wrapper to that already-shipped
STORY-042 module for the sake of one dropdown, the picker component
calls the existing admin endpoints directly: `GET
/api/admin/homepage-builder/layouts?status=Published` to find the
live layout's id, then `GET /api/admin/homepage-builder/layouts/[id]`
to read its `sections` (already includes `type`/`titleOverride`, no
new fields needed). If a second caller ever needs this same read, that
would be the point to promote it to a real `homepage-builder.service.ts`
export — not before.

**Testing:** `tests/unit/seasonal-campaign-service.test.ts` (9 tests)
— CRUD + audit logging, the full status-transition table (Edit vs.
Approve, an illegal `Draft → Active` skip rejected), the date-range
Zod refine, and the performance summary proven against real linked
`PromotionalPopup`/`Coupon`/`EmailSmsCampaign` fixtures (including a
real `Order` + `CouponRedemption` row, since `CouponRedemption.orderId`
is a required, unique FK — there is no lighter-weight way to create a
redemption). `tests/e2e/admin-seasonal-campaigns.spec.ts` — a View/
Edit-only admin's `Scheduled → Active` attempt is rejected server-side
(403, via a separate browser context); the full-access admin links a
real, already-Published popup (with real recorded impressions) from
the editor's picker, walks the real UI through
Draft → Scheduled → Active → Ended, and the performance panel shows
that popup's real impression count throughout.

## 2026-10-02 — STORY-051 split, and STORY-051a Per-Page SEO Fields + SeoFieldsPanel

Researching STORY-051 (SEO Console) before building it found it was
already bigger than its own doc suggested: `Product`, `Recipe`, and
`BlogPost` each already had their own inline, duplicated `metaTitle`/
`metaDescription` columns (Product and BlogPost also had `ogImage`;
Product alone had `canonicalUrl`), each with its own admin form fields
and its own `generateMetadata()` reading them directly — and nothing
for redirects, sitemap.xml, robots.txt, or a shared cross-entity admin
component existed anywhere. Comparable in size to all five STORY-050
sub-stories combined. **Confirmed with the user: split the same way
STORY-050 was split** — 051a (this entry) → 051b (Redirect Manager) →
051c (Sitemap/Robots/Structured Data) → 051d (Bulk Edit + Health
Scoring), recorded in `docs/blueprint.md` Section 9a item 7 the same
way item 6 records the STORY-050 split.

**Full migration, not an additive bolt-on.** `SeoMeta` (new, polymorphic
via `(entityType, entityId)` — Prisma can't express a single FK
pointing at one of several different models) is now the single source
of truth for these fields; Product/Recipe/BlogPost's own columns were
removed, not left duplicated alongside the new table. This is what the
AC actually asks for ("per-page SEO fields... from one console") and
what `docs/stories/09-quality-security/STORY-068-seo-validation-qa.md`
(read in full before starting) depends on: it expects one
CMS-sourced metadata path across every page template, not two. Leaving
the old columns in place "for now" would mean two places an admin
could set the same title/description with no indication which one
wins — worse than not building this at all.

**`ogImageUrl`/`ogImageAlt` (plain strings), not `ogImageId` (an FK) —
a deliberate correction to the story doc's own wording.** Every other
Media-Library-picked image field in this schema (`PromotionalPopup.
imageUrl`, `HeroBannerSlide.desktopImageUrl`, etc.) is a plain URL +
alt-text string pair, never a `MediaAsset` foreign key —
`AssetPickerDialog`'s `onSelect` already hands back `{ url, altText }`,
never an id to store. Following the story doc's FK design would have
made `SeoMeta` the one inconsistent field in the whole schema *and*
created a real migration problem: Product/BlogPost's existing `ogImage`
was already a plain URL, with no reliable way to resolve it back to a
`MediaAsset` row. `ogImageUrl`/`ogImageAlt` instead made the migration
a direct 1:1 column copy.

**Discovered mid-implementation: `db push`, not `migrate dev`, for the
actual schema change.** `prisma/migrations/` is frozen at
`add_checkout_orders` (2026-09-28) — every schema change since
(Coupons, Popups, Seasonal Campaigns, Landing Pages, ~15 stories) went
through `db push` only, never a tracked migration (confirmed by
listing the migrations folder before acting). Running `migrate dev` for
just this story would have improperly bundled all of that unrelated
historical drift into one "051a" migration file, and this repo has no
real deployment pipeline yet that consumes migration files (hosting is
still an unconfirmed open item per blueprint.md Section 10) — so there
was no actual production data-loss risk to guard against. Followed this
project's own established, consistent precedent instead: `db push`,
same as every story since STORY-029. Local dev data for the migrated
columns was disposable seed data (confirmed empty row counts before and
after), so no backfill was needed locally. **Honest gap, not fixed
here:** adopting tracked migrations for a real deployment later will
need either a fresh baseline migration or a proper backfill written at
that time.

**`SeoFieldsPanel` is a self-contained mini-editor, not threaded through
each parent form's own `react-hook-form` instance** — it fetches and
saves its own `SeoMeta` row via its own API/client, with its own "Save
SEO fields" action, completely decoupled from Product/Recipe/BlogPost's
own save flow. This is the only way shared infrastructure could sit
inside three differently-shaped existing forms without rewriting any of
their own submit logic. **A real bug this caught, not a test-only
curiosity:** the panel's first draft used a real `<form onSubmit>`,
which — nested inside the parent content form's own `<form>` — is
invalid HTML; React logged a hydration error and the nested submit
button's click didn't reliably reach the handler. Fixed by making the
panel's own "Save" a plain button `onClick` calling `handleSubmit`
directly, never a second `<form>` element. When `entityId` is `null`
(the entity hasn't been created yet), it renders a "Save this page
first..." placeholder — the same conditional-render-until-an-id-exists
pattern the Popup editor's status actions and performance panel already
use.

**Health checklist is a pure, framework-agnostic helper
(`src/lib/seo-health.ts`), deliberately not inside `seo.service.ts`** —
that file transitively imports the Node-only Prisma client and would
break if imported from the client-side `SeoFieldsPanel`. The AC's
*central, filterable* list of all pages by health status is 051d's job,
not this one — this is just the per-page checklist.

**Testing:** `tests/unit/seo-service.test.ts` (7 tests) — upsert-on-
missing-row behavior, permission gating (View vs. Edit), and every
`computeSeoHealth` case. Regression: the full Product/Recipe/Blog
service/repository/route suites (191 tests across 14 files) confirmed
clean after removing the inline columns — nothing else read `metaTitle`
etc. directly off those models. `tests/e2e/admin-seo-fields.spec.ts` —
creates a real product through the real admin console, sets a price (a
Published product with no resolvable price 404s on the storefront —
`product.service.ts`'s own guard), edits its SEO fields through the
embedded panel, and confirms a separate, real storefront visitor sees
the custom title on `/products/[slug]`.

## 2026-10-02 — STORY-051b Redirect Manager

Second of the four STORY-051 sub-stories. Independent of 051a (no
shared model). Confirmed before starting: no `Redirect` model, no
`next.config.ts` `redirects()` block, `src/proxy.ts` had zero redirect-
resolution logic, no CSV library or bulk-import precedent anywhere in
this codebase, and no in-memory Map/TTL cache pattern anywhere either —
all four genuinely new for this story.

**Conflict detection needs no graph traversal.** A new redirect is
rejected when (1) `sourcePath === destinationPath` (self-loop), (2)
`destinationPath` equals any existing active redirect's `sourcePath`
(the new redirect would point at something that itself redirects
elsewhere), or (3) `sourcePath` equals any existing active redirect's
`destinationPath` (something already redirects here). Banning any
single 2-hop chain this way transitively bans every loop too — a cycle
of any length requires at least one such link to exist at some point
during its construction, so there's nothing to walk. `detectRedirectConflict`
is a pure, exported function (`redirect.service.ts`) reused identically
by single-row create/update and by the CSV bulk importer (which
additionally accumulates each newly-accepted row into the checked set,
so a batch can't create a chain/loop/duplicate against itself either).
Plain duplicate `sourcePath` detection is separate: a DB `@unique`
constraint plus an `isUniqueSourcePathViolation` error-shape-sniffing
helper, the same pattern `coupon-admin.service.ts`/`coupon.service.ts`
already use for `Coupon.code`.

**A real, non-obvious bug this project's own helper pattern has: the
`@prisma/adapter-pg` driver echoes a camelCase unique-constraint
column's name *with its quote characters still attached*** (e.g. the
array element is the literal string `"sourcePath"`, not `sourcePath`)
— confirmed by logging the raw error. `Coupon.code`'s own
`isUniqueCodeViolation` helper never surfaced this because `code` is
already lowercase and needs no Postgres quoting. `isUniqueSourcePathViolation`
strips quote characters before comparing
(`field.replaceAll('"', "") === "sourcePath"`). Worth a quick check if
any *future* `isUniqueXViolation`-style helper is written for a
camelCase column — the existing `code`-based ones happen to work by
accident of being lowercase, not because the pattern is quote-safe.

**The cache TTL is the only freshness mechanism — eager invalidation
across the proxy/route-handler boundary doesn't work, discovered via a
failing e2e test, not assumed.** The first implementation added
`invalidateRedirectCache()` calls after every write (create/update/
delete/bulk-import) on the theory that `src/proxy.ts` and the API route
handlers share one Node.js process and therefore one module-scope cache
instance, with a 30s TTL as a pure fallback. An e2e test creating a
redirect and immediately visiting it failed — 404, not a redirect, even
though the admin console round-trip had clearly succeeded. Lowering the
TTL to 2s and adding a matching wait made it pass, proving the real
mechanism was the TTL elapsing, not the invalidation call. Root cause:
Next.js compiles `proxy.ts` (middleware) into a separate module bundle
from route handlers, even within the same process — the invalidation
call nulls the route-handler bundle's own copy of the cache state, which
nothing reads; `proxy.ts` has its own, separate copy that only the TTL
ever clears. The invalidation calls are kept (harmless, correct for any
future same-bundle reader) but every comment near them now says
explicitly that they don't fix `proxy.ts`'s freshness. Shipped TTL: 10
seconds — short enough that an admin testing a just-created redirect
doesn't perceive it as broken, long enough to still meaningfully cut DB
load under real traffic. The e2e test waits 11s before its redirect
assertion, by design, to exercise real eventual-consistency behavior
rather than a lucky cold-cache race.

**CSV import: a hand-rolled line/comma parser (`src/lib/csv.ts`), not a
new dependency.** No CSV library exists in this project and the data
shape is fixed and simple (`sourcePath,destinationPath,statusCode`);
URL paths don't contain commas in practice. Full RFC4180 quoted-field
handling is unneeded complexity for this shape — a deliberate, bounded
scope cut, not an oversight.

**`statusCode` is a plain `Int`, not an enum** — unlike this schema's
other status fields (which model a semantic workflow state), this one
*is* literally an HTTP status code; Zod constrains it to `301 | 302` at
the validation layer instead.

**Testing:** `tests/unit/redirect-service.test.ts` (9 tests) — CRUD +
audit logging, permission gating, the real DB duplicate-path error,
every `detectRedirectConflict` case (self-loop, both chain directions,
a clean accept), and a full CSV bulk-import scenario (valid rows, an
in-batch duplicate, a row chaining against a real existing DB redirect,
a malformed line) with exact per-line failure attribution.
`tests/unit/csv.test.ts` (6 tests) and `tests/unit/redirect-cache.test.ts`
(2 tests, mocking the repository to prove single-fetch-serves-many and
concurrent-miss de-duplication without real timers). `tests/e2e/admin-redirects.spec.ts`
— a View-only admin's create attempt is rejected server-side (403); the
full-access admin creates a redirect through the real console; a
separate, real storefront visitor hitting the old path is actually
redirected once the cache TTL elapses, proving the `proxy.ts`
integration end-to-end, not just the admin CRUD.

## 2026-10-03 — STORY-051c Sitemap.xml / robots.txt + Structured Data

Third of the four STORY-051 sub-stories. Depends on 051a's `SeoMeta`
and 051b's `Redirect`. Research before planning found the AC's
structured-data bullet already half-satisfied by earlier stories:
`ProductJsonLd`/`RecipeJsonLd`/`BlogJsonLd` (Product/Recipe/Article-
BlogPosting) already existed, each rendering through one shared
`JsonLdScript` helper (`src/components/storefront/product/json-ld-script.tsx`),
wired into their own detail pages. Organization was the one content
type with zero existing implementation, and no per-page override
mechanism existed at all — `SeoMeta` had nothing JSON-LD-related.
Nothing for `sitemap.xml`/`robots.txt` existed anywhere.

**Reused, did not rebuild, the existing Product/Recipe/BlogPosting
JSON-LD components.** The AC's "default JSON-LD template per content
type with field mapping" is satisfied by what already shipped — each
is a working, already-tested, hardcoded-but-correct field mapping.
Rebuilding them as a generic DB-driven template system would have been
a risky rewrite of stable code for no practical gain — nothing asks
for admin-configurable *field mapping*, just that a template exists
per type. Only two genuine gaps got built: Organization (new, static —
site identity doesn't vary per page, so no admin CRUD; STORY-054
System Settings is the natural future home if it ever needs to be
admin-editable) and a per-page override (new, on `SeoMeta`).

**Per-page override (`SeoMeta.jsonLdOverride Json?`) is a full
replacement, not a deep merge.** When set, the page renders exactly
that JSON instead of calling `ProductJsonLd`/etc. at all. A partial
merge risks producing an invalid combined schema.org object from
incomplete admin input; a full replacement is simpler and predictable.
`SeoFieldsPanel`'s new "Advanced: custom structured data (JSON-LD)"
textarea edits raw JSON text as its own local component state (not
react-hook-form's value) — parsed client-side immediately before save,
with an inline error on invalid JSON, so the wire format and the
stored Prisma `Json` field are always real JSON, never an unparsed
string. Clearing the field back to "no override" uses `Prisma.DbNull`
(SQL `NULL`), not `Prisma.JsonNull` (the JSON value `null`) — the two
are genuinely different things for a Prisma `Json?` column, and only
the former means "nothing here."

**No logo in the Organization schema — confirmed absent, not
guessed.** schema.org's `logo` field is optional; the real Oristor
logo is a webpack-bundled static import (`src/assets/logo/Logo.png`,
used only via `next/image`), not a file at any stable, public,
absolute-URL-resolvable path. Fabricating a `public/`-rooted guess
would just 404 for crawlers. Add it once a logo file actually lives at
a fixed `public/` path.

**`sitemap.ts`/`robots.ts` are thin callers into a service
(`sitemap.service.ts`), not inline logic** — matches this project's
Service Layer rule and makes the entry-building logic unit-testable
without the Next.js metadata-route runtime. Reuses every content
type's existing bulk "published" repository function
(`findPublishedProductsForListing`, `findPublishedRecipes`,
`findPublishedBlogPosts`, `findPublishedCookingTips`,
`findPublishedFoodAcademyEntries`, `listAllCategories` filtered to
`Active`, `listActiveCollections`) — Landing Pages were the one gap (no
bulk "published-only" listing existed, only a single-by-slug read and
an admin list spanning every status), closed with a small new
`listPublishedLandingPages()` the same shape as every other content
type's. Excludes anything `SeoMeta.robotsIndex: false` (new
`seo.repository.ts::listRobotsExcludedEntityIds`, reused for Product/
Recipe/BlogPost — the only three `SeoEntityType` values) and any path
that's an active `Redirect.sourcePath` (reusing 051b's existing
`listActiveRedirects()` — no new redirect-side code). `robots.txt`
stays fully static, no DB dependency — "stays in sync with redirect
settings" is satisfied by the real HTTP redirect behavior itself
(051b, already live in `proxy.ts`); a crawler hitting a redirected path
gets redirected regardless of what `robots.txt` says, so there's
nothing here that needs to read the `Redirect` table.

**Extracted the copy-pasted `SITE_URL` fallback into one shared module
(`src/lib/site-url.ts`)** — confirmed duplicated 5 times across the
codebase before this story (2 as a named constant in
`products/[slug]/page.tsx` and `recipes/[slug]/page.tsx`, 3 as an
inline expression in unrelated services, plus a 6th inline occurrence
in the root `layout.tsx`'s own `metadataBase`). The sitemap, robots,
and the new Organization JSON-LD all needed it; this story updated the
3 in-scope call sites (the 2 named constants plus `layout.tsx`) to
import the shared one instead of adding a 7th copy. The 3 inline
expressions in `auth.service.ts`/`customer-referrals-dashboard.service.ts`/
`profile.service.ts` were left alone — unrelated purpose, out of this
story's blast radius, a documented future cleanup opportunity.

**Testing:** `tests/unit/sitemap-service.test.ts` (5 tests) —
`buildSitemapEntries()` against real created fixtures (reusing
`tests/unit/recipe-fixtures.ts`'s shared `makeRecipe`/`makeBlogPost`/
etc. helpers rather than duplicating fixture setup): static pages
present, a published product/recipe/post included, a
`robotsIndex: false` product excluded, a redirected path excluded,
categories/collections/a published landing page included.
`tests/unit/seo-service.test.ts` extended with the `jsonLdOverride`
round-trip + `DbNull`-clears-it case. `tests/e2e/sitemap-and-structured-data.spec.ts`
— `robots.txt`'s disallow rules and sitemap pointer; a real product's
`/sitemap.xml` entry confirmed present, then confirmed gone after
toggling `robotsIndex` off through the real `SeoFieldsPanel`; a real,
separate storefront visitor loading the product's real PDP sees the
custom `jsonLdOverride` content in a `<script type="application/ld+json">`
tag instead of the auto-generated `ProductJsonLd` output (checked
across every ld+json script on the page, not by DOM position, since
the sitewide `OrganizationJsonLd` script is also present on every
page).

## 2026-10-03 — STORY-051d Central Pages List: Bulk SEO Editing + Health Scoring

The fourth and last STORY-051 sub-story, closing out the whole SEO
Console split (051a-d all done).

**OG-image dimensions are persisted on `SeoMeta` (`ogImageWidth`/
`ogImageHeight`, `Int?`), not re-derived from `MediaAsset` by URL at
health-check time.** `AssetPickerDialog`'s `onSelect` payload already
carries `width`/`height` on its `MediaAsset` object — `SeoFieldsPanel`
just wasn't capturing them. Re-deriving from `MediaAsset` later would
be fragile: an admin can type an OG image URL by hand, with no
`MediaAsset` row behind it at all. `computeSeoHealth`
(`src/lib/seo-health.ts`, STORY-051a) gained a 5th check,
`ogImageTooSmall` (warns below 1200x630, the standard Open-Graph-rich-
preview minimum across Facebook/Twitter/LinkedIn), extending the
existing pure function rather than building a parallel health system
for the central list — the per-page checklist and the central audit
share one set of rules.

**The central list (`/admin/seo`, `listSeoPagesForAdmin`) reuses
Product/Recipe/BlogPost's own admin list *services*
(`listProductsForAdmin`/`listRecipesForAdmin`/`listPostsForAdmin`),
not their repositories directly** — each already defaults to every
status (not just Published) when no status filter is passed, so "give
me everything" is just a `pageSize: 10_000` call (the same
`BULK_LIST_SIZE` approach `sitemap.service.ts` already used for this
catalog's size), no new "list all" repo functions needed. This also
means `listSeoPagesForAdmin` inherits each service's own
`requirePermission` check (`Products`/`Recipes`/`Blog` View) on top of
its own `SEO` View check — belt and suspenders, but harmless: every
admin role in this project already gets View everywhere outside its
own home modules, so this never actually blocks the SEO Specialist
persona this story is for. `AdminProductListRow`'s select gained
`slug` (previously unused by the admin product table, which links by
id) since the central list needs it to build each row's real
storefront URL.

**Duplicate-title detection and all list filtering happen in-memory
over one unified, already-fetched list — no new DB-side duplicate
query.** One new `seo.repository.ts::listSeoMetaForEntityIds(entityType,
entityIds)` batch read per content type (3 queries total, not an N+1
against each row) feeds a merge keyed on `entityType:entityId`.
Duplicates are flagged on the *effective* title (`metaTitle ??
ownTitle`), the same fallback the storefront's own `generateMetadata`
calls already use — otherwise two pages with the same real SEO title
but no explicit `metaTitle` override would go undetected.

**The bulk title-template apply (`bulkApplyTitleTemplate`) is a
`{title}`-placeholder string substitution, not a rich template
engine**, matching the AC's own "e.g. a title formula" framing — no
richer syntax was asked for. It delegates to `seo.service.ts`'s
existing `updateSeoMeta` per ref (reading the row's current `SeoMeta`
first so every other field survives untouched), the same way
`product-admin.service.ts`'s `bulkChangeStatus` delegates to its own
single-row `changeProductStatus` — reuses that function's permission
check and audit log per row rather than duplicating either. Unlike
`bulkChangeStatus`'s real illegal-transition failures, there is no
natural per-row failure mode here (`SeoMeta` has no FK to its
polymorphic target, so even a bogus `entityId` would just create a
row) — the per-row try/catch stays anyway, for resilience and
consistency with the house pattern, but isn't exercised by a forced
failure case in the unit tests.

**The bulk-edit UI convention gained one addition: surfacing per-row
failure reasons, not just the succeeded count.** Every prior bulk
action in this codebase (products, orders, reviews, etc.) only ever
announced "`N of M updated`" — this story's list also renders each
failure's reason, since an SEO specialist bulk-editing dozens of pages
at once needs to know *which* ones didn't take, not just how many.

**Testing:** `tests/unit/seo-pages-service.test.ts` (new,
5 tests) — the unified list includes a Draft product/recipe/post (not
just Published), two pages sharing an effective title are both flagged
as duplicates while an unrelated third is not, a page with no `SeoMeta`
row surfaces `missingDescription`; `bulkApplyTitleTemplate` expands the
placeholder and preserves a row's other existing fields, and also
correctly creates a first-ever row (robots flags defaulting to `true`)
for an entity that never had one. `tests/unit/seo-service.test.ts`
extended with `ogImageTooSmall` cases (below/above the threshold, and
"no dimensions known yet" treated as nothing-to-flag, same convention
`missingOgAlt` already uses for "no image set"). `tests/e2e/admin-seo-
pages.spec.ts` — the real central list shows two real products; the
"missing description" filter narrows to the incomplete one and hides
the complete one; selecting the incomplete one and applying a title
template updates it (confirmed by the Meta title column changing after
the list's own refetch); picking a real, genuinely-small `MediaAsset`
through the real `SeoFieldsPanel` on that product's own admin page
shows the new "Social image is at least 1200x630" health check failing
live, before any save.

## 2026-10-03 — STORY-052 Navigation & Menu Management

Replaces `src/lib/nav-config.ts`/`footer-config.ts`'s hardcoded arrays
with an admin-editable, DB-backed system — both files' own header
comments already anticipated this story. Confirmed genuinely
greenfield: no `Menu` model existed, only an `AdminModule.Navigation`
enum placeholder with no consumer. Built as one story (user's explicit
choice over a 050/051-style split, despite comparable combined scope).

**Mega Menu is a 4th admin *tab*, not a 4th `MenuLocation`.** Only 3
real locations (`Header`/`Footer`/`Mobile`) — mega-menu content is
nested `MenuItem` children under a Header item via the self-relation
`parentId`, matching `nav-config.ts`'s existing `NavItem.megaMenu?:
MegaMenuSection[]` shape. The Mega Menu tab is a separate `MenuTreeEditor`
instance scoped to one Header item's subtree (`rootParentId`/`rootDepth`
props added to support this), not a parallel data structure. Max
nesting depth is enforced in the service layer only (Prisma can't
express recursive depth constraints): Header 2 levels (top item →
section → link/promo), Footer 1 (column → link), Mobile flat.

**Publish/rollback mirrors STORY-042's `HomepageLayout` exactly** — a
`Draft`/`Published`/`Archived` status enum on `Menu` itself, no
separate version/snapshot table. `menu.repository.ts::publishMenuSwappingPrevious`
is `homepage-layout.repository.ts::publishLayoutSwappingPrevious` with
one addition: the swap's `findFirst` is scoped by `location`, so
publishing Header never archives Footer's or Mobile's published row.
Rollback republishes the most-recently-Archived row for that location
via the same primitive, same as `homepage-builder.service.ts`'s
`rollbackToPrevious`. Unlike Homepage Builder's multi-draft workflow,
Navigation keeps exactly one Draft per location at a time, auto-
vivified (`getDraftMenu`) rather than requiring an explicit "new draft"
action — simpler mental model, appropriate since nav items change far
less often than homepage layouts and don't need parallel draft
branches.

**Visibility is a scoped-down `PopupAudienceTarget`.** `MenuItemVisibility`
has 3 cases (`Always`/`Authenticated`/`CustomerGroupTarget`) instead of
`popup.service.ts`'s full 7-case audience targeting — loyalty/referral
targeting doesn't make sense for a nav item. `menu-visibility.service.ts`'s
`matchesMenuVisibility` mirrors `matchesAudience`'s switch shape at a
smaller scale.

**Internal-route validation reuses `sitemap.service.ts`'s
`buildSitemapEntries()`, plus a separate, broader static-routes list.**
The sitemap's own static-page list is scoped to SEO indexing and
deliberately excludes real, legitimate routes (account pages, legal
pages, search) that a nav item can still validly link to — confirmed
by checking it omits `/about`, `/account`, `/legal/*`, etc.
`link-check.service.ts::checkInternalPath` strips the query string
before comparing (nav links commonly point at a base route with
filters, e.g. `/products?collection=best-sellers`, not a discrete
sitemap entry) and checks against the static list first, falling back
to the sitemap's entries for detail pages. External URL checking
(`checkExternalUrl`, a single `fetch(..., { method: "HEAD" })`) has an
injectable `ExternalUrlChecker` parameter specifically so tests never
make a real network call.

**The nested drag-and-drop tree (`menu-tree-editor.tsx`) is the one
genuinely novel piece of UI in this codebase** — every prior dnd-kit
usage (`homepage-builder-canvas.tsx`, `hero-banner-editor.tsx`) is a
single flat `SortableContext`. This is the standard dnd-kit "multiple
containers" pattern: one `DndContext`, one `SortableContext` per
container (siblings sharing a parent), each container also a
`useDroppable` zone (needed so an empty container is still a valid
drop target), and `onDragEnd` compares the dragged item's current
`parentId` against the drop target's container to decide reorder vs.
reparent. An early version had a real off-by-one bug here: the "Add
item" button's visibility check used `depth < maxDepth` (correct for
"can this item have children," since a child sits one level deeper)
copy-pasted into the wrong place — the container's own "can I add one
more item at my own depth" check needs `depth <= maxDepth`, since the
container's items sit *at* `depth`, not one below it. Caught by the e2e
test, which would have shown a nonfunctional "Add item" button on the
Header tab's own top-level editor (the first thing any admin would try)
had it shipped.

**`NavItem.icon` had to become a string (an icon *name*), not the
`LucideIcon` component reference it was before this story.**
`navigation.service.ts`'s storefront-resolution functions now run in an
async Server Component (`Header`) and pass their result as a prop into
a Client Component (`NavLinks`) — a React component/function reference
cannot cross that serialization boundary (Next.js throws "Functions
cannot be passed directly to Client Components"). Fixed by storing an
icon *name* string (a key into the existing `src/lib/menu-icons.ts`
curated map, already used for the admin icon picker) on `NavItem`
instead, resolved to a component only by whichever Client Component
actually renders one (`mobile-nav.tsx`, `mobile-drawer-links-list.tsx`
— desktop `NavLinks` never renders an icon at all). This also required
rewriting `nav-config.ts`'s static arrays to use the same string
convention, for type consistency between the hardcoded and DB-backed
cases. Caught by the e2e test's dev-server crash, not a type error —
`LucideIcon` objects are structurally valid at compile time; the
violation is a runtime RSC-boundary rule TypeScript doesn't model.

**`MegaMenuPanel` needs a `NavigationMenuRoot` context even in the
standalone admin preview.** It's normally rendered inside
`NavigationMenuContent` as part of `NavLinks`' real hover/trigger flow,
and its links use `NavigationMenuLink` internally, which throws
without that ancestor context. The Mega Menu tab's own preview
(`MegaMenuPreview`) has no real trigger to hover, so it wraps the panel
in a minimal `NavigationMenu`/`NavigationMenuList`/`NavigationMenuItem`
with a fixed `defaultValue` to force the content open uncontrolled by
any interaction, rather than reimplementing `MegaMenuPanel`'s markup
without the primitive (which would stop being a faithful preview).

**Two small, genuinely reusable presentational components were
extracted, not duplicated, for the preview pane:** `FooterColumnsGrid`
(out of `footer.tsx`) and `MobileDrawerLinksList` (out of
`mobile-menu-drawer.tsx`). Both the real storefront component and the
admin preview pane import the same one — the preview is pixel-faithful
by construction, not a maintained-separately mock.

**The e2e test deliberately never publishes-and-checks a real
storefront page load.** Header/Footer/Mobile are global, every-page
content, and this project's Playwright config runs with
`fullyParallel: true` — `header.spec.ts`/`footer.spec.ts`/`search.spec.ts`
all assert against the real, default nav content on every run. A
published test menu sitting in the shared dev database for even a few
seconds (the time between this spec's own `publish` call and its
cleanup) risks flaking those unrelated specs if their workers happen to
load a storefront page in that window. The publish/rollback atomic-swap
and the published-menu-to-`NavItem` mapping are both already covered at
the service layer in `navigation-service.test.ts` with zero real HTTP
exposure, so `admin-navigation.spec.ts` instead covers what only a
browser can: the real nested drag-and-drop, the link checker, and the
Publish button's own UI feedback — confirmed by re-running
`header.spec.ts`/`footer.spec.ts`/`search.spec.ts` together with this
new spec to verify no cross-test interference.
