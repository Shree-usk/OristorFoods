# STORY-051d: Central Pages List — Bulk SEO Editing + Health Scoring

**Status:** Draft
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** SEO Specialist, Super Administrator

## Context

The fourth of four sub-stories split out of STORY-051 (SEO Console) —
confirmed with the user 2026-10-02, recorded in `docs/blueprint.md`
Section 9a. **Depends on 051a** (`SeoMeta` rows across Product/Recipe/
BlogPost are what this story's list view reads, filters, and bulk-
edits). Covers
`docs/stories/07-enterprise-admin-platform/STORY-051-seo-console.md`'s
bulk-editing AC bullet and the *central, filterable* half of the
health-indicators bullet (051a already built the per-page checklist
via `src/lib/seo-health.ts`'s `computeSeoHealth` — reuse it here rather
than duplicating the scoring rules).

This is also where `docs/stories/09-quality-security/STORY-068-seo-
validation-qa.md`'s two remaining expectations belong: real-time
save-time field-length validation (50–60 char titles, 150–160 char
descriptions) and OG-image minimum-dimension enforcement (`MediaAsset.
width`/`height` are already on the model, confirmed during 051a's
research) — 051a deliberately left both out since it has no central
editing surface for them to live in.

This codebase already has a well-established bulk-edit UI pattern to
follow, confirmed during 051a's research: a `Set<string>` of selected
row ids + per-row checkbox + a `bulkXxx(ids, ...)` server action
returning a success/failure summary, then query invalidation — see
`admin-product-list-view.tsx`, `admin-orders-list-view.tsx`, and the
reviews/Q&A/blog-comments moderation queues for reference
implementations.

## Acceptance Criteria (from the umbrella story)

- [ ] A searchable, central list of all pages with their SEO status
- [ ] Bulk SEO editing filters pages missing a meta title/description
      or with duplicate titles, and can bulk-apply a templated pattern
      (e.g. a title formula) across the filtered set
- [ ] Real-time, save-time validation of title/description length and
      OG-image dimensions (STORY-068's dependency)

## References

- `docs/stories/07-enterprise-admin-platform/STORY-051-seo-console.md`
  (the umbrella story)
- `docs/stories/07-enterprise-admin-platform/STORY-051a-per-page-seo-fields.md`
  (the `SeoMeta` model and `computeSeoHealth` helper this story reuses)
- `docs/stories/09-quality-security/STORY-068-seo-validation-qa.md`
  (the save-time validation and OG-image dimension checks this story
  owns)
- `docs/blueprint.md` Section 9a (the sub-story split decision)
