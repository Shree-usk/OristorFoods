# STORY-073: Our Story — Interactive Storytelling About Page

**Status:** Done
**Epic:** 11 — Missed Stories
**Priority:** Medium
**Persona(s):** Prospective Customer, Export/Wholesale Buyer, Brand-Curious Visitor

**Numbering note:** the user's source doc ("PROJECT OristorFoods — OUR STORY PAGE.txt") had no
self-assigned story number. Numbered as the next free slot after STORY-072. Original
instructions preserved verbatim at `docs/stories/11-missed-stories/PROJECT OristorFoods — OUR
STORY PAGE.txt`.

## User Story
As a prospective customer or brand-curious visitor, I want to discover ORISTOR's story as an immersive journey rather than a static About page, so that I come away understanding the brand's Sri Lankan heritage and craftsmanship, not just a list of corporate facts.
As an export/wholesale buyer evaluating ORISTOR as a partner, I want the page to credibly convey quality, tradition, and global ambition, so that it builds confidence before a business conversation even starts.

## Description
Replaces the currently non-existent `/about` page (no About route exists anywhere in this
codebase; `/about` and `/sustainability` are both tracked as live-linked 404s in
project memory) with an interactive, scroll-driven storytelling experience: **"From Our Roots
to Your Table."** The page takes the visitor through a sequence of visual chapters — Sri Lanka
→ heritage → ingredients → traditional recipes → craftsmanship → quality → global reach —
using real ORISTOR product photography and the project's approved company profile content,
never invented history, dates, achievements, or certifications.

The brief explicitly cites a Dribbble reference (Kumo Interactive Matcha) as **UX inspiration
only** — the underlying interaction *philosophy* (product + imagery + motion + scrolling =
storytelling) is the thing to learn from, not its layout, graphics, typography, colors,
animations, or text. The finished page must read as unmistakably ORISTOR/Cinnamon, built from
the existing design system (Cormorant Garamond for editorial headlines, Inter for body/UI,
the existing Ivory/Charcoal/Gold/Chilli Red/Leaf Green palette) — not a re-skinned matcha site.

## Acceptance Criteria
- [x] Interactive "Our Story" page implemented at `/about` (confirmed, not assumed, against `nav-config.ts`/`footer-config.ts`'s real entries), working on desktop/tablet/mobile
- [x] Cinematic hero ("A Taste of Sri Lanka, Crafted for the World") using real Oristor product imagery — emotional and premium, not a corporate About-page header. **No video and no Sri Lankan landscape photography**: neither exists in this project; the user decided real ingredient/product close-ups (already-real photography) replace landscape imagery entirely, never a stock/placeholder substitute
- [x] A sequence of scroll-driven chapters covering: the land/origin, ingredients, traditional recipes/craftsmanship, the company itself (using the real approved Vision/Mission text from `docs/blueprint.md`, not the brief's own unverified paraphrase), an interactive product story (a pinned/horizontal sequence through 6 real product categories — adapted from the brief's 7-item list since no "Thokku" photography exists), the seven-value O-R-I-S-T-O-R framework (revealed progressively, the user's own authored content for this page), a quality narrative (real process framing, zero certification claims — none is verified anywhere in this project), and a "Sri Lanka to the World" export-ambition section
- [x] A final emotional closing section with primary ("Explore Products") and secondary ("Meet The Oristor") CTAs — linking to real, working destinations (`/products`, `/contact-us`)
- [x] All product/company content is real: actual Oristor product photography (43 real files, confirmed already in use by `prisma/seed-recipes.ts`) and the real approved blueprint.md Vision/Mission/tagline text only — no invented products, history, dates, achievements, or certifications; no product label/logo/packaging/color/texture/name is ever altered
- [x] Reusable, modular components built for this page (`story-hero`, `story-chapter`, `ingredient-reveal`, `product-story-scroll`, `value-reveal`, `global-journey`, `story-cta`), not one monolithic page file
- [x] Motion serves the storytelling purpose only (scroll-triggered reveals via the existing `ScrollReveal`, a pinned horizontal product sequence via newly-added `useScroll`/`useTransform`) — `prefers-reduced-motion` is respected throughout; the pinned sequence specifically falls back to a plain vertical stack when reduced motion is preferred, confirmed via a real e2e test
- [x] Mobile experience is a deliberately adapted version of the interaction: the pinned/horizontal product sequence converts to a vertical `ScrollReveal` stack below the `lg` breakpoint (confirmed via a real e2e test at a 375px viewport), not a shrunk desktop animation
- [x] WCAG AA considerations addressed — confirmed via a real axe check (zero critical/serious violations) and correct heading hierarchy (fixed a real bug caught by the e2e test: the Values section's title was a plain `<p>`, not an `<h2>`, before the test caught it)
- [x] SEO: title, meta description, canonical URL, a single proper `<h1>` (the Hero's own headline), semantic heading hierarchy, Organization structured data via the existing `JsonLdScript` component
- [x] Performance: no heavy embedded video/landscape assets, `next/image` `fill`+`sizes` throughout (mirroring `recipe-hero.tsx`'s own established pattern), `priority` limited to the Hero and the product sequence's first image only
- [x] Unit test for `product-story-scroll.tsx` (the one component with real conditional branching logic, matching this codebase's own precedent for what gets unit-tested — `scroll-reveal.test.tsx`/`compare-view.test.tsx`); an e2e test confirming the page loads, every chapter heading is reachable, the product sequence renders correctly, CTAs resolve to real destinations, desktop/mobile/reduced-motion variants all render correctly, and a zero-violation axe pass
- [x] Production build passes; existing pages and navigation are not broken (confirmed via a regression run of the pre-existing `motion.spec.ts`, which already navigated to `/about` and now finds real content there instead of a 404)

## Scope Decisions (resolved during research/planning, before implementation)
- **Route confirmed**: `/about`, matching `nav-config.ts:79`/`footer-config.ts:43` exactly.
- **A dedicated content/asset-inventory research pass ran before planning**, per this story's own stated gate. Findings: real product photography exists (43 files) but is not DB-linked; real company text exists in `docs/blueprint.md` but not the brief's own exact quote (the real Vision/Mission text is used instead); no Sri Lanka/landscape imagery exists anywhere; the O-R-I-S-T-O-R framework doesn't exist elsewhere in this project (blueprint.md has a different, real 10-value list); no certification is verified anywhere.
- **Two findings required the user's own decision, both resolved directly**: (1) no landscape imagery exists — the user chose real ingredient/product close-ups over sourcing new photography or a text-forward redesign; (2) the O-R-I-S-T-O-R framework diverges from blueprint.md's real values list — the user chose to use it as-is, as their own authored content for this page specifically, not a replacement for the project's operational brand-values list.
- **Certifications honestly omitted** — a real `Certification` Prisma model exists but zero rows are ever seeded, and no ISO/HACCP/GMP claim appears anywhere in approved project content. The Quality chapter keeps a real-process narrative (ingredients → production → packaging → finished product) but drops every certification badge/claim — same honesty standard as every other "no real data" gap this session.
- **No backend/schema/API work at all** — a fully static page, no new Prisma model, no admin console. None of this content is admin-editable per-field the way product/recipe data is; it's a one-off brand narrative page, same treatment as the existing static `/export` page copy.

## Dependencies
- Existing Cinnamon design system (typography, palette, Shadcn UI, Framer Motion)
- Real product photography/content (Products catalog, Food Academy, existing brand assets)
- STORY-067 (Accessibility), STORY-066 (Performance) — same bar-at-ship-time note as STORY-072

## Out of Scope
- Inventing company history, dates, achievements, or certifications not documented in approved project content
- Copying the Kumo Interactive Matcha reference's layout, graphics, typography, colors, product presentation, animations, text, composition, or branding — UX philosophy only
- The separate `/sustainability` page gap (tracked independently in project memory)

## References
- Original brief: `docs/stories/11-missed-stories/PROJECT OristorFoods — OUR STORY PAGE.txt`
- `docs/blueprint.md` (design system, brand palette/typography, IA)
