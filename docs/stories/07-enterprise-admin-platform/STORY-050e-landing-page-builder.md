# STORY-050e: Landing Page Builder

**Status:** Done (core scope). See `docs/architecture-decisions.md`
2026-10-02 entry for the Hero-Banner-shaped-blocks scoping decision
(and why the other 10 Homepage section types don't fit), the
new-models-not-shared-with-homepage decision, and the Edit/Approve
status-transition split.

**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Marketing Manager, Super Administrator

## Context

The last of the three remaining STORY-050 (Marketing Console)
sub-stories that STORY-050c (Seasonal campaign hub) depends on —
050a (Popups) and 050b (Coupons/Promotions) were already merged;
050d (Email/SMS/WhatsApp) merged immediately before this. STORY-050c
is now unblocked (`docs/blueprint.md` Section 9a).

AC bullet (STORY-050's umbrella doc): *"A landing page builder creates
a simple no-code page (headline, hero image via Media Library, content
blocks, CTA, own URL slug) for campaign-specific traffic, reusing
STORY-042's section component library."*

STORY-042 (Homepage Visual Builder) ships 11 section types, but only
**Hero Banner** is genuinely admin-authored, reusable content — the
other 10 just toggle visibility/title over hardcoded sitewide fixture
data. Confirmed with the user before implementation: a landing page is
an ordered stack of Hero-Banner-shaped blocks, reusing
`hero-banner-slide.tsx`'s render component directly.

## Acceptance Criteria

- [x] Admin can create a landing page (internal name, its own URL
      slug, optional SEO meta title/description)
- [x] Admin can add, edit, reorder, and remove content blocks, each
      with a headline, optional subheadline/supporting text, CTA ×2,
      a hero image via the Media Library (desktop required, mobile
      optional), optional video, overlay toggle, and alignment
- [x] A preview shows the page before publishing (desktop/mobile
      toggle), reusing the same renderer the public page uses
- [x] Draft → Published → Archived workflow; `Archived` ↔ `Draft`
      round-trip supported; `Edit` gates the low-risk direction,
      `Approve` gates whatever makes a page publicly reachable
- [x] The public page lives at `/landing/<slug>`, 404s for anyone
      when the page is `Draft`/`Archived` (no enumeration via direct
      slug guessing)
- [x] Every create/update/block-change/status-change is audit-logged

## Tasks

- [x] **Database:** `LandingPage` (name, slug `@unique`, status,
      metaTitle, metaDescription, publishedAt, createdById) +
      `LandingPageBlock` (field-for-field identical to
      `HeroBannerSlide`) + `LandingPageStatus` enum (reuses the
      existing `ContentAlignment` enum for block alignment, since that
      one's genuinely shared).
- [x] **Repository:** `landing-page.repository.ts` — CRUD for both
      models, `findPublishedLandingPageBySlug` (the storefront's own
      read, `Published` + visible-blocks-only), `reorderBlocks` (a
      simple sequential `sortOrder` rewrite — no dnd-kit needed at
      this scope).
- [x] **API:** `/api/admin/marketing/landing-pages` (list/create),
      `/[id]` (detail/update), `/[id]/status`, `/[id]/blocks`
      (create), `/blocks/[blockId]` (update/delete),
      `/[id]/blocks/reorder`.
- [x] **Service/Backend:** `landing-page.service.ts` — permission
      gating + audit logging, the Edit/Approve status-transition
      table (mirrors `popup.service.ts`'s exact shape), slug-conflict
      translation (reuses `product-admin.service.ts`'s established
      `@prisma/adapter-pg` P2002-detection pattern), the
      storefront-facing `getPublishedLandingPageBySlug` (no permission
      gate, mirrors `homepage.service.ts`'s split from
      `homepage-builder.service.ts`).
- [x] **Frontend:** `/admin/marketing/landing-pages` (list, `new`,
      `[id]` edit — the same three-route shape as STORY-050a's popup
      console); the editor's block list reuses `AssetPickerDialog`
      exactly as `hero-banner-editor.tsx` does, and the preview
      renders real blocks through the imported `HeroBannerSlide`
      component. `/landing/[slug]` — the public page,
      `generateMetadata` + `notFound()` + a direct service call,
      mirroring `/recipes/[slug]`'s exact shape.
- [x] **Validation:** `landing-page.schema.ts` — slug format (same
      regex as `product-admin.schema.ts`), CTA label/href pairing,
      Hero-Banner-shaped block field requirements.
- [x] **Testing:** `tests/unit/landing-page-service.test.ts` (10
      tests — CRUD + audit logging, slug uniqueness, block CRUD +
      reorder, the full status-transition table, and the storefront
      read proven to return nothing for a non-Published page and the
      real ordered blocks for a Published one). Regression:
      `homepage-builder-service` (12 tests, confirming no shared code
      was touched). `tests/e2e/admin-landing-pages.spec.ts` (a
      View/Edit-only admin's publish attempt gets a real 403; the
      full-access admin builds and publishes a real page with a real
      Media Library image through the real console; a real storefront
      visitor sees it render at its slug; an unpublished page's slug
      404s).
- [x] **Documentation:** `docs/architecture-decisions.md` 2026-10-02
      entry.

## Dependencies

- STORY-042 (Homepage Visual Builder) — `hero-banner-slide.tsx`, the
  one component this story reuses directly
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-041 (Media Library) — `AssetPickerDialog`, every block image
  field's selection mechanism

## Out of scope (deliberate, documented, not silently skipped)

- Embedding any of Homepage's other 10 section types (Best Selling
  Products, Customer Reviews, etc.) on a landing page — they're not
  real, reusable admin-authored content; surfaced to and resolved with
  the user before implementation
- Full drag-and-drop block reordering (dnd-kit) — simple up/down move
  buttons are proportionate to this story's page sizes; `reorderBlocks`
  the repository function already supports a richer UI later without
  a data-model change
- Scheduling a publish/unpublish at a future date — the same "no cron
  infrastructure exists" constraint STORY-042 and STORY-050d already
  documented

## References

- `docs/stories/07-enterprise-admin-platform/STORY-050-marketing-console.md`
  (the umbrella story)
- `docs/stories/07-enterprise-admin-platform/STORY-042-homepage-visual-builder.md`
  (the section this story reuses from)
- `docs/blueprint.md` Section 9a (the sub-story split decision)
