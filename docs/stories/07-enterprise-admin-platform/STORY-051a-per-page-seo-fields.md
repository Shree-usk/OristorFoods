# STORY-051a: Per-Page SEO Fields + SeoFieldsPanel

**Status:** Done (core scope) — see `docs/architecture-decisions.md`
2026-10-02 entry for deviations (full migration off Product/Recipe/
BlogPost's own inline SEO columns rather than an additive bolt-on;
`ogImageUrl`/`ogImageAlt` plain strings instead of the source doc's
`ogImageId` FK; `db push` instead of a tracked `migrate dev` migration,
since this repo's migration history is frozen well before this change
and gets no benefit from one yet; the nested-`<form>` bug the panel's
self-contained design caught and fixed).

**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** SEO Specialist, Content Editor, Super Administrator

## Context

The first of four sub-stories split out of STORY-051 (SEO Console) —
confirmed with the user 2026-10-02, recorded in `docs/blueprint.md`
Section 9a. Built first and deliberately foundational: every other
051 sub-story either depends on `SeoMeta` existing (051c, 051d) or is
wholly independent of it (051b). It covers the first half of
`docs/stories/07-enterprise-admin-platform/STORY-051-seo-console.md`'s
AC bullet 1 (the per-page field editor, both inline on each content
module's edit screen and the shared component itself) and the health-
indicators bullet, scoped to the per-page checklist only — the central,
filterable, cross-entity list is 051d's job.

## Acceptance Criteria

- [x] A shared, embeddable SEO field editor (meta title, meta
      description, canonical URL, OG image via Media Library with alt
      text, robots index/follow directives, focus keyword) is available
      inline on each of Product/Recipe/BlogPost's own edit screens
- [x] Each page shows SEO health indicators (missing meta description,
      title length out of recommended range, missing OG image alt
      text, no canonical set) as a per-page checklist
- [x] Every public page template (`/products/[slug]`, `/recipes/[slug]`,
      `/blog/[slug]`) sources its title/description/canonical/robots
      metadata from this single `SeoMeta` source, not per-model columns

## Tasks

- [x] **Database:** `SeoMeta` (polymorphic: `entityType`, `entityId`,
      `metaTitle`, `metaDescription`, `canonicalUrl`, `ogImageUrl`,
      `ogImageAlt`, `robotsIndex`, `robotsFollow`, `focusKeyword`);
      removed the now-redundant inline columns from `Product`,
      `Recipe`, `BlogPost`.
- [x] **API:** `/api/admin/seo/[entityType]/[entityId]` (GET, PATCH).
- [x] **Service/Backend:** `seo.service.ts` (permission-gated CRUD,
      audit-logged); `src/lib/seo-health.ts` (the pure, framework-
      agnostic health-checklist helper, importable from the client-side
      panel without pulling in the Node-only Prisma client).
- [x] **Frontend:** `SeoFieldsPanel` (`src/components/admin/seo/`) —
      self-contained, its own fetch/save, embedded in
      `admin-product-form.tsx`, `admin-recipe-form.tsx`, and
      `admin-blog-post-form.tsx`'s own "SEO" tabs, replacing each
      form's previous inline SEO fields.
- [x] **Validation:** `seo.schema.ts` — all fields optional/nullable;
      no hard length limits yet (that's 051d/068's "real-time save-time
      validation" territory).
- [x] **Testing:** `tests/unit/seo-service.test.ts` (7 tests — upsert-
      on-missing-row, permission gating, every `computeSeoHealth`
      case); full Product/Recipe/Blog regression (191 tests across 14
      files); `tests/e2e/admin-seo-fields.spec.ts` (real product →
      real price → real SEO edit through the panel → real storefront
      title).
- [x] **Documentation:** `docs/architecture-decisions.md` 2026-10-02
      entry documents the full-migration decision, the `ogImageUrl`
      correction, the `db push` vs. `migrate dev` call, and the
      embedding contract.

## Dependencies

- STORY-038 (Admin Auth & RBAC) — gates this module's actions (the
  `SEO` `AdminModule` value and the `seo_specialist`/`marketing_manager`
  role grants already existed, confirmed before starting — no RBAC
  changes needed)
- STORY-040 (Products), STORY-043 (Recipes), STORY-044 (Blog) — their
  admin forms embed `SeoFieldsPanel` in place of their own former
  inline SEO fields
- STORY-041 (Media Library) — `AssetPickerDialog` for the OG image field

## Out of scope (left for the remaining 051 sub-stories or future work)

- Redirect management — 051b
- `sitemap.xml`/`robots.txt` generation, structured-data (JSON-LD)
  templates — 051c
- A central, filterable list of all pages with bulk SEO editing — 051d
- Hard save-time length validation and OG-image minimum-dimension
  enforcement (STORY-068's own expectations) — left for 051d, which
  owns the central editing surface those checks belong in
- `Category`/`Collection`/`RecipeCategory`/`LandingPage`'s own separate
  inline SEO fields — explicitly out of this story's AC (Products/
  Recipes/Blog only); left untouched, unaffected by this migration

## References

- `docs/stories/07-enterprise-admin-platform/STORY-051-seo-console.md`
  (the umbrella story)
- `docs/stories/09-quality-security/STORY-068-seo-validation-qa.md`
  (downstream QA pass this story's output must satisfy)
- `docs/blueprint.md` Section 9a (the sub-story split decision)
