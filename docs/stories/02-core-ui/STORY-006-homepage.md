# STORY-006: Homepage

**Status:** Done
**Epic:** 02 — Core UI
**Priority:** High
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast, Distributor, Executive (all site visitors)

## User Story
As a first-time site visitor, I want a homepage that immediately communicates Oristor's premium, authentic Sri Lankan food brand and shows me where to start (best sellers, recipes, categories), so that I understand what the site offers and want to explore further.

As a Home Cook or Gourmet Food Enthusiast, I want to see best-selling products, featured recipes, and curated collections on the homepage, so that I can quickly find something appealing without navigating deep into the catalogue.

As a Distributor or Executive, I want to see Export Solutions and brand-trust content (Why Choose Oristor, Customer Reviews) on the homepage, so that I can evaluate Oristor as a serious B2B/wholesale partner.

## Description
This story builds `src/app/(storefront)/page.tsx`, the homepage, with every section in the exact order specified in `docs/blueprint.md` Section 4: Hero Banner → Featured Categories → Why Choose Oristor → Best Selling Products → Featured Recipes → Product Collections → Food Academy → Customer Reviews → Export Solutions → Rewards Club → Instagram Gallery → Newsletter → Footer. Per blueprint Section 9 item 2, Core UI is "done when homepage is responsive and complete." This story delivers each section's static/CMS-shaped presentation layer (markup, layout, animation hooks, responsive behavior) using placeholder or lightly-mocked data where the real backing data model doesn't exist yet; it explicitly does not build the product, recipe, or review data layer itself — those are owned by later epics and are called out below as Dependencies (not blockers), since STORY-042 (Homepage Visual Builder, admin) will eventually let non-technical staff drive this content section-by-section per blueprint Section 7.

## Acceptance Criteria
- [x] `page.tsx` renders 11 sections in exact blueprint order (Hero → Featured Categories → Why Choose Oristor → Best Selling Products → Featured Recipes → Product Collections → Food Academy → Customer Reviews → Export Solutions → Rewards Club → Instagram Gallery). **Deviation:** "Newsletter" (blueprint's 12th item) is satisfied by the existing site-wide `<Footer>` (STORY-005), not a duplicate second newsletter form — see `docs/architecture-decisions.md`. "Footer" (13th item) is the same site-wide component.
- [x] Every section is its own component under `src/components/storefront/home/`, each independently composable/testable — plus a shared `teaser-section.tsx` primitive backing the three structurally-identical teaser sections
- [x] Hero Banner: headline/subheadline/CTA/background image, `text-hero` on `sm:`+ scaling down to `text-h1` on mobile
- [x] `CategoryCardData[]`, `ProductCardData[]`, `RecipeCardData[]`, `CollectionCardData[]` (plus `ReviewData[]`, `InstagramPostData[]`, `WhyChooseFeatureData[]`, `TeaserSectionData`) defined in `src/types/home.ts`, consumed via props from `page.tsx` — components never import fixtures directly
- [x] Customer Reviews: grid of typed testimonials, star ratings, warm/trustworthy tone. Text-only — no fabricated stock headshots (documented reasoning)
- [x] Instagram Gallery: responsive image grid from fixture data, links open in a new tab with `rel="noopener noreferrer"` — verified by e2e test
- [x] Responsive at all four target viewports — verified via `tests/e2e/layout.spec.ts`'s existing overflow suite (now exercising the full homepage) plus manual scroll-through screenshots at 375px and 1440px
- [x] `ScrollReveal` (STORY-008) used throughout every section for entrance animation; respects `prefers-reduced-motion` (inherited from the primitive itself)
- [x] Every image uses `next/image` with `fill` + an `aspect-square`/`aspect-4/3` container (explicit dimensions via CSS, not inline width/height) — no CLS from images. **Lighthouse Performance >95 not numerically measured in this environment** — same honest caveat as STORY-003; real Lighthouse auditing is STORY-066's job
- [x] Semantic heading hierarchy: exactly one `<h1>` (Hero), `<h2>` per subsequent section — verified by e2e test
- [x] Homepage passes an automated axe scan with **zero critical/serious violations** on the full assembled page
- [x] All section components are Server Components; `ScrollReveal` (motion) is the only Client Component boundary within each

## Tasks
- [x] **Frontend:** Built `page.tsx` composing all 11 sections
- [x] **Frontend:** Built all 11 section components + the shared `teaser-section.tsx` primitive
- [x] **Frontend:** Defined all data-shape types in `src/types/home.ts`
- [x] **Frontend:** Built `src/lib/fixtures/home-fixtures.ts` — using real product photography already present in `public/images/products/**` (43 files) rather than inventing placeholder images
- [x] **Frontend:** `ScrollReveal` wired onto every section's entrance
- [x] **Validation:** `npx tsc --noEmit` passes with zero errors, no `any`
- [x] **Testing:** `tests/e2e/homepage.spec.ts` — rewritten from the old placeholder-content test to 6 real tests: section order, single-h1, footer-newsletter presence, product card content, Instagram link attributes, axe scan
- [x] **Testing:** Responsive coverage via existing `layout.spec.ts` viewport suite + manual scroll-through visual verification (documented gotcha: a naive `fullPage` screenshot makes `ScrollReveal` content look broken — see architecture-decisions.md)
- [x] **Testing:** Axe scan — zero critical/serious violations
- [x] **Testing:** Lighthouse not run in this environment — documented as a caveat, not silently skipped
- [x] **Documentation:** Section data-shape contracts documented via TSDoc in `src/types/home.ts`; full deviation/decision log in `docs/architecture-decisions.md` (Newsletter dedup, real photography choice, shared teaser primitive, retired STORY-001 FadeIn, Base UI `nativeButton` gotcha, screenshot gotcha)

## Dependencies
- STORY-001 (Project Foundation Setup)
- STORY-002 (Design System & Theming)
- STORY-003 (Global Layout & Responsive Framework) — provides `Container`/`Section` primitives
- STORY-004 (Primary Navigation & Header) — homepage renders inside the shared shell with header
- STORY-005 (Footer) — homepage's final section is the shared footer
- STORY-008 (Animation Framework) — scroll-reveal/entrance animation primitives
- Non-blocking data dependencies (sections use fixture data until these land): STORY-009/010 (Product Catalogue, Product Listing) for Featured Categories, Best Selling Products, Product Collections; STORY-017 (Recipe Centre & Listing) for Featured Recipes; STORY-015 (Product Reviews & Ratings) for Customer Reviews; STORY-020 (Food Academy) for the Food Academy teaser; STORY-030 (Rewards / Loyalty Club) for the Rewards Club teaser; STORY-058 (Export Portal) for Export Solutions content; STORY-042 (Homepage Visual Builder, admin) for eventually making every section CMS-editable.

## Out of Scope
- Real product, recipe, review, rewards, or export data — this story uses typed fixture data; live data wiring belongs to the epics listed under Dependencies.
- Homepage Visual Builder admin UI (STORY-042) — this story only shapes component props so the builder can eventually drive them.
- Live Instagram API integration — gallery uses static fixture images.
- AI-powered personalization of homepage content (Epic 08 — AI Platform).

## References
- `docs/blueprint.md` Section 4 (Homepage sections in order)
- `docs/blueprint.md` Section 6 (Non-Functional Principles — performance, accessibility)
- `docs/blueprint.md` Section 7 (Homepage Visual Builder, for future context)
- `docs/blueprint.md` Section 9 item 2 (Core UI — "done when homepage is responsive and complete")
- `docs/folder-structure.md` (`src/app/(storefront)/page.tsx`, `src/components/storefront/`)
