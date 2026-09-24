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
