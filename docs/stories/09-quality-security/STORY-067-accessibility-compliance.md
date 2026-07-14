# STORY-067: Accessibility Compliance

**Status:** Draft
**Epic:** 09 — Quality & Security
**Priority:** High
**Persona(s):** User with Accessibility Needs, Platform Stakeholder, Engineering Team, Compliance/Security Officer

## User Story
As a user with accessibility needs (e.g. relying on a screen reader, keyboard-only navigation, or low-vision assistive technology), I want every storefront and account flow to be fully operable and understandable without a mouse or without sight, so that I can browse, learn about, and buy Oristor products with the same confidence as any other customer.
As a compliance/security officer, I want the platform validated against WCAG 2.1 AA, so that Oristor meets its accessibility obligations and avoids legal/reputational risk before launch.
As the engineering team, I want automated and manual accessibility testing wired into the development workflow, so that accessibility regressions are caught before merge, not discovered after launch.

## Description
This story delivers the accessibility half of Build Order item 9, "Quality & Security" (`docs/blueprint.md` Section 9), targeting the Section 6 non-functional principle "Accessibility" and Section 8's mandatory PR accessibility gate. It is a platform-wide audit and remediation pass against **WCAG 2.1 Level AA**, covering every customer-facing flow built in Epics 02–06 (navigation, homepage, product/recipe browsing and detail, cart/checkout, customer dashboard) as well as the admin console (Epic 07), since Section 7 states admin roles must be usable by non-technical staff. It also validates the Oristor brand palette (Section 2) for sufficient color contrast in real UI contexts, not just in isolation.

## Acceptance Criteria
- [ ] Every page/template built in Epics 02–07 passes automated accessibility scanning (axe-core or equivalent) with **zero critical or serious violations**, run via Playwright + `axe-playwright` (or `@axe-core/react` in dev) as part of CI
- [ ] All interactive elements (nav menus, mega menu, filters, product gallery/zoom, cart, checkout form, modals/sheets, admin data tables, drag-and-drop builders) are fully operable via keyboard alone — confirmed by manual keyboard-only walkthroughs of: homepage → product browse → product detail → add to cart → checkout, and account login → dashboard → order history
- [ ] Visible focus indicators are present and meet a minimum 3:1 contrast ratio against adjacent colors on every focusable element site-wide (no `outline: none` without a compliant custom focus style)
- [ ] Semantic HTML is used throughout: proper heading hierarchy (single `<h1>` per page, no skipped levels), `<nav>`/`<main>`/`<footer>`/`<header>` landmarks, `<button>` vs `<a>` used per their semantic purpose (never a `<div onClick>` for an interactive control)
- [ ] All non-decorative images (product photography, recipe images, category icons, Instagram gallery per Section 4 homepage) have descriptive `alt` text; purely decorative images use `alt=""` or `aria-hidden="true"` — verified by an automated alt-text coverage audit finding zero missing/generic (`"image"`, `"photo"`) alt attributes on customer-facing pages
- [ ] Every Oristor brand color combination used for text-on-background in the live UI is validated against WCAG AA contrast ratios (4.5:1 normal text, 3:1 large text/UI components) using the palette in `docs/blueprint.md` Section 2 — specifically: Charcoal (`#2F2B2A`) on Ivory (`#FAF7F2`), Chilli Red (`#B22222`) CTA text/buttons, Oristor Gold (`#CDAF52`) accents on Ivory/Cream, Leaf Green (`#2E8B57`) success states, and Stone Grey (`#8A817C`) supporting text — any combination failing AA is flagged with a documented remediation (e.g. darkened variant for text use) before use in production components
- [ ] All form fields (checkout, registration, login, contact, newsletter, admin CRUD forms) have programmatically associated labels, clear error messaging announced to assistive technology (`aria-live` or `aria-describedby` on validation errors from React Hook Form + Zod), and are navigable/submittable via keyboard
- [ ] Screen reader walkthroughs (NVDA or VoiceOver, at minimum one full pass each) are completed and documented for the critical customer journey (browse → product detail → cart → checkout → confirmation) and account flows, with findings logged and remediated
- [ ] Skip-to-content link is present and functional on every page for keyboard/screen-reader users to bypass repeated navigation
- [ ] All modals, drawers/sheets (mobile filter panel, cart drawer), and dropdown menus correctly trap and restore focus, and are dismissible via `Escape`
- [ ] Dynamic content updates (cart item count, live search results, toast notifications, form validation errors) are announced via appropriate ARIA live regions
- [ ] Video content (recipe videos, Food Academy per Section 4/5) has captions or a documented plan for captioning before launch
- [ ] Reduced-motion preference (`prefers-reduced-motion`) is respected by all Framer Motion animations site-wide
- [ ] An accessibility statement/conformance page exists documenting the WCAG 2.1 AA target, known exceptions, and a feedback contact channel

## Tasks

- [ ] **Frontend:**
  - [ ] Audit and fix heading hierarchy and landmark structure across all templates built in Epics 02–07
  - [ ] Add/fix `alt` text across all image-rendering components (`ProductGallery`, `RecipeCard`, category icons, Instagram gallery, admin Media Library thumbnails)
  - [ ] Implement or fix visible focus styles project-wide via shared Tailwind/Shadcn theme tokens rather than per-component overrides, so the fix is centralized and consistent
  - [ ] Fix keyboard trap/focus-restore behavior on all modal, sheet, and dropdown components in `src/components/ui/` and `src/components/storefront/`
  - [ ] Add a skip-to-content link in the root layout
  - [ ] Wrap Framer Motion animation configs to respect `prefers-reduced-motion` via a shared hook/utility
  - [ ] Add `aria-live` regions for cart count updates, toast notifications, and async search/filter result updates
  - [ ] Remediate any brand color combination that fails WCAG AA contrast when used for text (e.g. define an accessible darker gold/red variant for small text use) and update the shared design tokens from STORY-002

- [ ] **Service/Backend:**
  - [ ] Confirm React Hook Form + Zod validation error messages are exposed via `aria-describedby`/`aria-invalid` on form fields across checkout, registration, login, and admin forms

- [ ] **Validation:**
  - [ ] Add/verify `alt` text and ARIA-label fields are required (or explicitly nullable-with-decorative-flag) in the CMS/admin data model for product, recipe, and media entries so content editors cannot publish images without addressing alt text

- [ ] **Testing:**
  - [ ] Integrate `axe-core`/`@axe-core/playwright` into the Playwright e2e suite, running against every major template, wired into CI as a blocking check per Section 8's PR accessibility gate
  - [ ] Conduct and document manual keyboard-only walkthroughs of the critical customer and account journeys
  - [ ] Conduct and document at least one full NVDA and one full VoiceOver screen-reader pass over the critical customer journey
  - [ ] Run a color-contrast audit tool (e.g. axe, Stark, or a scripted contrast checker) against every brand color combination in Section 2 as used in live components; record pass/fail per combination
  - [ ] Add an automated alt-text coverage check (script or CI lint) scanning rendered HTML for missing/generic `alt` attributes on customer-facing routes

- [ ] **Documentation:**
  - [ ] Publish an Accessibility Compliance Report summarizing WCAG 2.1 AA conformance status, automated scan results, manual test findings, and remediations
  - [ ] Publish the accessibility statement/conformance page with known exceptions and a feedback channel
  - [ ] Document the accessible color-token remediations in `docs/architecture-decisions.md` so future components inherit compliant tokens by default

## Dependencies
- All prior epics (01-08) — this epic validates and hardens what has been built, it runs continuously alongside feature work per blueprint Section 8's mandatory PR validation gates, and again as a dedicated pass before Epic 10 Production Launch

## Out of Scope
- Full WCAG 2.1 AAA conformance (AA is the target per this story; AAA items may be noted as stretch goals but are not required for launch)
- Video captioning production work itself if it requires third-party vendor/translation services beyond an English transcript (a documented plan/timeline is in scope; full multi-language captioning is not)
- Native mobile app accessibility (ODEP is a responsive web platform per Section 3; no native app is in scope)

## References
- `docs/blueprint.md` Section 2 (Brand Identity — color system, typography)
- `docs/blueprint.md` Section 6 (Non-Functional Principles — Accessibility)
- `docs/blueprint.md` Section 8 (Development Governance — mandatory PR accessibility gate)
- `docs/blueprint.md` Section 9 item 9 (Quality & Security)
