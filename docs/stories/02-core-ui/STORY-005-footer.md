# STORY-005: Footer

**Status:** Done
**Epic:** 02 — Core UI
**Priority:** High
**Persona(s):** site visitor (all personas), Sri Lankan Expat, Distributor

## User Story
As a site visitor, I want a footer with organized links to every part of the site, so that I can find pages that aren't in the primary nav (like Sustainability or Referral Programme) without hunting.

As a Gourmet Food Enthusiast, I want to sign up for the newsletter and follow Oristor on social media directly from the footer, so that I can stay engaged with the brand after I leave the page.

As a Sri Lankan Expat or Distributor, I want to find contact details and legal/compliance information (certifications, policies) in the footer, so that I can trust the brand and reach the company for export or bulk enquiries.

## Description
This story implements the site-wide footer that appears on every storefront page, per `docs/blueprint.md` Section 4 (Homepage sections end in "... → Newsletter → Footer") and Section 9 item 2 (Core UI). The footer surfaces secondary navigation (including items not present in the primary header nav, e.g. Sustainability, Customer Portal, Referral Programme), a newsletter signup, social links, legal/compliance links, and contact information — reinforcing the Trust and Authenticity principles from blueprint Section 6.

## Acceptance Criteria
- [x] `footer.tsx` renders site-wide inside `(storefront)/layout.tsx`, below `<main>` (and below `<MobileNav>`, in document order, but visually last)
- [x] Four-column link structure exactly as specified (Shop/Learn/Company/Account), surfacing IA-tree items absent from the header nav (Sustainability, Customer Portal, Referral Programme, Wishlist, etc.) — verified by e2e test
- [x] Newsletter form (RHF + Zod) posts to a real route handler via TanStack Query's `useMutation`, shows inline success/error state, no stub UI — only the underlying email service is a stub (as scoped)
- [x] Social links (Facebook/Instagram/YouTube) open in a new tab with `rel="noopener noreferrer"` — verified by e2e test. **Deviation:** icons are hand-written inline SVGs, not Lucide React — `lucide-react` v1.x removed all brand icons entirely (verified: 0 of 5,980 exports match any brand name). Documented in architecture-decisions.md.
- [x] Legal/compliance row: copyright (dynamic year), Privacy Policy, Terms of Service links, and explicit placeholder certification badges (ISO/HACCP) — text-only, not fabricated logo graphics, since the underlying certifications aren't confirmed in the blueprint
- [x] Company contact info (address/phone/email) — placeholder values, explicitly flagged in code as such (blueprint doesn't specify real ones)
- [x] Fully responsive: `grid-cols-2 sm:grid-cols-4` link columns, `lg:grid-cols-[2fr_3fr]` overall layout; verified no horizontal overflow via the existing `tests/e2e/layout.spec.ts` viewport suite (footer is present on every page those tests already cover)
- [x] Dark variant (Charcoal bg / Ivory text) — deliberate choice per the AC's own suggestion; full contrast reasoning (including where brand Chilli/Leaf fail against Charcoal) documented in architecture-decisions.md
- [x] Newsletter form is keyboard-accessible with an associated `<label>`, inline validation errors via `role="alert"`, no page reload (mutation-based) — verified by e2e test
- [x] Footer passes an automated axe scan with **zero critical/serious violations**
- [x] Footer is a Server Component; `NewsletterForm` is the only Client Component boundary inside it

## Tasks
- [x] **API:** `src/app/api/newsletter/subscribe/route.ts` — validates with Zod, calls the service, returns 400 on invalid input
- [x] **Service/Backend:** `src/services/newsletter.service.ts` — stub `subscribe()`, no direct Prisma/DB calls from the route
- [x] **Frontend:** Built `footer.tsx` with the four-column structure, contact row, and legal row
- [x] **Frontend:** Built `newsletter-form.tsx` (Client Component) using React Hook Form + Zod + TanStack Query `useMutation`
- [x] **Frontend:** Built `social-links.tsx` — using hand-written inline SVGs (`social-icons.tsx`) instead of Lucide React; see deviation note above
- [x] **Validation:** `src/validation/newsletter.schema.ts` shared between the client form and the API route
- [x] **Testing:** `tests/unit/newsletter-schema.test.ts` — 3 Vitest tests (valid/malformed/missing email)
- [x] **Testing:** `tests/e2e/footer.spec.ts` — 5 Playwright tests: renders + IA-tree links, validation error, success without reload, social link attributes, axe scan
- [x] **Testing:** Axe scan included above; also had to fix `tests/e2e/header.spec.ts` locator scoping since footer link labels now collide with header nav labels (see architecture-decisions.md)
- [x] **Documentation:** Footer config (`src/lib/footer-config.ts`) and every deviation (icon library gap, dark-surface contrast, placeholder data, test-scoping gotcha) documented in `docs/architecture-decisions.md`

## Dependencies
- STORY-001 (Project Foundation Setup)
- STORY-002 (Design System & Theming) — color tokens, typography, icon set
- STORY-003 (Global Layout & Responsive Framework) — footer mounts into the storefront shell

## Out of Scope
- Real newsletter/CRM/email-service integration (deferred to Enterprise Platform / Marketing Console epic) — this story wires a stub service and UI only.
- CMS-editable footer content (STORY-052, STORY-053).
- Full Sustainability, Export, and legal policy page content (owned by their respective content stories) — footer only links to them.

## References
- `docs/blueprint.md` Section 4 (Site Structure — full IA tree, homepage section order ending in Newsletter → Footer)
- `docs/blueprint.md` Section 2 (Brand Identity — color, tone, trust values)
- `docs/blueprint.md` Section 3 (Forms stack: React Hook Form + Zod)
- `docs/folder-structure.md` (`src/components/storefront/`, `src/services/`, `src/app/api/`)
