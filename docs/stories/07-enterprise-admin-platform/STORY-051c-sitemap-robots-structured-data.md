# STORY-051c: Sitemap.xml / robots.txt + Structured Data

**Status:** Draft
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** SEO Specialist, Super Administrator

## Context

The third of four sub-stories split out of STORY-051 (SEO Console) —
confirmed with the user 2026-10-02, recorded in `docs/blueprint.md`
Section 9a. **Depends on 051a** (`SeoMeta`'s `robotsIndex`/
`robotsFollow` flags and per-page content drive the sitemap's inclusion
rules and any structured-data overrides). Covers
`docs/stories/07-enterprise-admin-platform/STORY-051-seo-console.md`'s
structured-data and sitemap/robots-sync AC bullets.

Confirmed before starting 051a: no `sitemap.xml`, `robots.txt`, or any
generation logic for either exists anywhere in this codebase yet
(no `src/app/sitemap.ts`/`robots.ts`, no static files under `public/`).
Wholly new — no placeholder to build on or conflict with.

## Acceptance Criteria (from the umbrella story)

- [ ] Structured data (schema.org) management provides a default
      JSON-LD template per content type (Product, Recipe, Article/
      BlogPosting, Organization) with field mapping, plus a per-page
      override
- [ ] `sitemap.xml` and `robots.txt` stay automatically in sync with
      published content and with any noindex/redirect settings

## References

- `docs/stories/07-enterprise-admin-platform/STORY-051-seo-console.md`
  (the umbrella story)
- `docs/stories/07-enterprise-admin-platform/STORY-051a-per-page-seo-fields.md`
  (the `SeoMeta` model this story reads `robotsIndex`/`robotsFollow`
  and per-page overrides from)
- `docs/blueprint.md` Section 9a (the sub-story split decision)
