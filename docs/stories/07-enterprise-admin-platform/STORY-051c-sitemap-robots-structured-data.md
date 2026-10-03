# STORY-051c: Sitemap.xml / robots.txt + Structured Data

**Status:** Done (core scope) — see `docs/architecture-decisions.md`
2026-10-03 entry for deviations (reused the already-existing Product/
Recipe/BlogPosting JSON-LD components rather than rebuilding them;
`jsonLdOverride` is a full replacement, not a merge; `sitemap.ts`/
`robots.ts` are thin callers of a service, matching this project's
Service Layer rule; the shared `SITE_URL` extraction).

**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** SEO Specialist, Super Administrator

## Context

The third of four sub-stories split out of STORY-051 (SEO Console) —
confirmed with the user 2026-10-02, recorded in `docs/blueprint.md`
Section 9a. Depends on 051a's `SeoMeta` model and 051b's `Redirect`
model. Research before starting found the AC's structured-data bullet
already half-satisfied: `ProductJsonLd`/`RecipeJsonLd`/`BlogJsonLd`
already existed, each rendering through one shared `JsonLdScript`
helper, wired into their own detail pages. Organization was the one
content type with zero existing implementation, and no per-page JSON-LD
override mechanism existed at all. Nothing for `sitemap.xml`/
`robots.txt` existed anywhere (confirmed, re-verified before starting).

## Acceptance Criteria

- [x] Structured data (schema.org) management provides a default
      JSON-LD template per content type — Product/Recipe/Article
      (BlogPosting) reuse the existing, already-tested components;
      Organization is new (static, rendered sitewide in the root
      layout) — plus a per-page override (`SeoMeta.jsonLdOverride`, a
      full replacement when set, editable via `SeoFieldsPanel`'s new
      "Advanced: custom structured data" field)
- [x] `sitemap.xml` stays in sync with published content, excluding
      anything an admin turned `robotsIndex` off for and any path
      that's an active `Redirect` source
- [x] `robots.txt` serves the expected disallow rules and points at the
      sitemap

## Tasks

- [x] **Database:** `SeoMeta.jsonLdOverride Json?` (new field).
- [x] **Backend:** `seo.repository.ts::listRobotsExcludedEntityIds`;
      `landing-page.repository.ts::listPublishedLandingPages`;
      `sitemap.service.ts::buildSitemapEntries()` (fans out to every
      content type's existing bulk-listing repo function in parallel);
      `src/lib/site-url.ts` (the extracted `SITE_URL` constant).
- [x] **Routes:** `src/app/sitemap.ts`, `src/app/robots.ts` — both thin
      callers into the service layer, not inline logic.
- [x] **Frontend:** `OrganizationJsonLd` (new, rendered once in
      `src/app/layout.tsx`); `SeoFieldsPanel`'s new JSON-LD textarea
      (client-side JSON.parse validation before save); the three
      detail pages (`products/[slug]`, `recipes/[slug]`, `blog/[slug]`)
      conditionally render the override via the existing
      `JsonLdScript` helper instead of their own `*JsonLd` component.
- [x] **Validation:** `seoMetaSchema.jsonLdOverride` — accepts any
      already-parsed JSON value (the client parses the raw textarea
      text before sending), not schema.org-validated.
- [x] **Testing:** `tests/unit/sitemap-service.test.ts` (5 tests —
      static pages, real published entities included, a
      `robotsIndex: false` product excluded, a redirected path
      excluded, categories/collections/landing pages included);
      `tests/unit/seo-service.test.ts` extended with a
      `jsonLdOverride` round-trip + DbNull-clears-it case;
      `tests/e2e/sitemap-and-structured-data.spec.ts` (`robots.txt`
      content; a real product's sitemap entry disappearing after
      toggling `robotsIndex` off through the real admin panel, and a
      real storefront visitor seeing a custom JSON-LD override instead
      of the auto-generated one).
- [x] **Documentation:** `docs/architecture-decisions.md` 2026-10-03
      entry documents the reuse-not-rebuild call, the full-replacement
      override design, the service-layer sitemap/robots structure, and
      the `SITE_URL` extraction.

## Dependencies

- STORY-051a (Per-page SEO Fields) — `SeoMeta`'s `robotsIndex`/
  `robotsFollow`/`jsonLdOverride` fields
- STORY-051b (Redirect Manager) — `Redirect.sourcePath`/`active`,
  reused as-is for sitemap exclusion
- STORY-040/043/044 (Products/Recipes/Blog) — the existing JSON-LD
  components this story reuses rather than rebuilds

## Out of scope (left as documented, deliberate gaps)

- A generic, DB-driven "field mapping" template system for Product/
  Recipe/BlogPosting JSON-LD — the existing hardcoded components
  already satisfy "a default template per content type"; rebuilding
  them would be a risky rewrite of stable code for no practical gain
- Admin-editable Organization fields — static for now; STORY-054
  System Settings is the natural future home if this ever needs to be
  admin-configurable
- A real logo URL in the Organization schema — no logo file exists at
  any stable, public, absolute-URL-resolvable path yet; `logo` is
  omitted (optional in schema.org's own spec) rather than guessed
- Schema.org structural validation of a `jsonLdOverride` value — only
  checked for valid JSON syntax, trusted admin input otherwise

## References

- `docs/stories/07-enterprise-admin-platform/STORY-051-seo-console.md`
  (the umbrella story)
- `docs/stories/07-enterprise-admin-platform/STORY-051a-per-page-seo-fields.md`
  (the `SeoMeta` model this story extends)
- `docs/stories/07-enterprise-admin-platform/STORY-051b-redirect-manager.md`
  (the `Redirect` model this story reads from)
- `docs/blueprint.md` Section 9a (the sub-story split decision)
