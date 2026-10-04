# STORY-073: Our Story — Interactive Storytelling About Page

**Status:** Draft
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
- [ ] Interactive "Our Story" page implemented at `/about` (or the project's established About route, confirmed during research — not assumed), working on desktop/tablet/mobile
- [ ] Cinematic hero ("A Taste of Sri Lanka, Crafted for the World") using real, large-format Sri Lankan food/product imagery or video — emotional and premium, not a corporate About-page header
- [ ] A sequence of scroll-driven chapters covering: the land/origin, ingredients, traditional recipes/craftsmanship, the company itself (using the approved company profile, not invented history), an interactive product story (a pinned/horizontal sequence through real product categories, not a conventional grid), the seven-value O-R-I-S-T-O-R framework (revealed progressively, not as a static block), quality/certifications (only where verified by real project data), and a "Sri Lanka to the World" export-ambition section
- [ ] A final emotional closing section with primary ("Explore Products") and secondary ("Meet The Oristor" or equivalent) CTAs
- [ ] All product/company content is real: actual Oristor product photography and approved company-profile text only — no invented products, history, dates, achievements, or certifications; product labels/logo/packaging/colors/texture/names are never altered (creative cropping/masking/composition of real photography is fine)
- [ ] Reusable, modular components built for this page (e.g. a story-chapter/hero/ingredient-reveal/product-story/value-reveal/quality-story/global-journey/CTA family), not one monolithic page file
- [ ] Motion serves the storytelling purpose only (scroll-triggered reveals, parallax, ingredient floating, product transitions, mask reveals, pinned sections) — no animation without a storytelling/UX purpose, no excessive bouncing/particle effects/unnecessary 3D, and `prefers-reduced-motion` is respected throughout, using the existing Framer Motion setup (no new animation framework without a documented technical reason)
- [ ] Mobile experience is a deliberately adapted version of the interaction (not a shrunk desktop animation): complex/horizontal sequences convert to vertical storytelling where needed, fewer simultaneous animations, readable typography, fast loading
- [ ] WCAG AA considerations addressed throughout (this page is one of the more animation-heavy ones in the app, so needs explicit attention alongside STORY-067)
- [ ] SEO: title, meta description, canonical URL, Open Graph metadata, single proper `<h1>`, semantic heading hierarchy
- [ ] Performance budget respected despite the heavy visual/animation content — optimized imagery, lazy-loaded chapters, no unnecessary third-party scripts
- [ ] Unit/component tests for the new reusable story components; an e2e test confirming the page loads, scrolls through its chapters, and its CTAs work; a reduced-motion e2e pass
- [ ] Production build passes; existing pages and navigation are not broken

## Scope Decisions (to confirm during research/planning, before implementation)
- **Confirm the actual route**: `docs/blueprint.md`'s own IA and IA-linked nav/footer reference `/about`; project memory also tracks `/sustainability` as a separate still-missing page the brief doesn't mention — out of scope for this story unless folded in deliberately.
- **Source real imagery/content before building any chapter** — this story must not proceed past planning until it's confirmed what real Oristor product photography, Sri Lanka/ingredient imagery, and approved company-profile text actually exist in this project to draw from; placeholder-only chapters are not acceptable per the brief's own "brand authenticity" instruction.
- **Certifications (ISO/HACCP/GMP) are only shown if genuinely verified** in existing project content — otherwise that section is honestly omitted, the same standard Epic 08's AI stories established for unavailable data.

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
