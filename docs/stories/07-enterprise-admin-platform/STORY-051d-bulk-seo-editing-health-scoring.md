# STORY-051d: Central Pages List — Bulk SEO Editing + Health Scoring

**Status:** Done (core scope)
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

- [x] A searchable, central list of all pages with their SEO status —
      `/admin/seo` (`AdminSeoPagesListView`), merging Product/Recipe/
      BlogPost (every status, not just Published) with their `SeoMeta`
      via one new `listSeoMetaForEntityIds` batch read per type.
- [x] Bulk SEO editing filters pages missing a meta title/description
      or with duplicate titles, and can bulk-apply a templated pattern
      (e.g. a title formula) across the filtered set — a `{title}`
      placeholder only, applied via `bulkApplyTitleTemplate`.
- [x] Real-time, save-time validation of title/description length and
      OG-image dimensions (STORY-068's dependency) — length feedback
      was already live via 051a's `computeSeoHealth` recomputing on
      every keystroke; OG-image dimensions are a genuinely new 5th
      check (`ogImageTooSmall`), fed by two new persisted `SeoMeta`
      columns captured at image-pick time.

## Implementation notes

- `SeoMeta` gained `ogImageWidth`/`ogImageHeight` (`Int?`), captured
  from `AssetPickerDialog`'s already-present `width`/`height` payload
  in `SeoFieldsPanel`'s `onSelect` handler — not re-derived from
  `MediaAsset` by URL at health-check time, since an admin can type an
  image URL by hand with no `MediaAsset` row behind it.
- Duplicate-title detection and all list filtering happen in-memory
  over one unified, already-fetched list (same reasoning
  `sitemap.service.ts` used for this catalog's size) — no new DB-side
  duplicate query. Duplicates are flagged on the *effective* title
  (`metaTitle ?? ownTitle`), the same fallback the storefront's own
  `generateMetadata` already uses.
- `bulkApplyTitleTemplate` delegates to `seo.service.ts`'s
  `updateSeoMeta` per ref (reading the existing row first to preserve
  every other field) rather than a new partial-update repository
  function — mirrors `product-admin.service.ts`'s `bulkChangeStatus`
  delegating to its own single-row `changeProductStatus`, reusing its
  permission check and audit log per row.
- The bulk-edit UI pattern's established convention (succeeded count
  only) was extended to also surface per-row failure reasons — an SEO
  specialist bulk-editing dozens of pages needs to know which ones
  didn't take, not just how many succeeded.

## References

- `docs/stories/07-enterprise-admin-platform/STORY-051-seo-console.md`
  (the umbrella story)
- `docs/stories/07-enterprise-admin-platform/STORY-051a-per-page-seo-fields.md`
  (the `SeoMeta` model and `computeSeoHealth` helper this story reuses)
- `docs/stories/09-quality-security/STORY-068-seo-validation-qa.md`
  (the save-time validation and OG-image dimension checks this story
  owns)
- `docs/blueprint.md` Section 9a (the sub-story split decision)
