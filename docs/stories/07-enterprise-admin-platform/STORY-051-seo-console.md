# STORY-051: SEO Console

**Status:** Draft
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** SEO Specialist, Content Editor, Super Administrator

## User Story
As an SEO Specialist, I want per-page SEO fields, redirect management, and structured data control from one console, so that I can maintain and improve search visibility across the whole site without developer involvement.
As an SEO Specialist, I want to bulk-edit SEO fields across many pages at once, so that I can fix systemic issues (like missing meta descriptions) efficiently.

## Description
This story delivers the SEO Console module from `docs/blueprint.md` Section 7: "per-page SEO fields, redirects, schema, bulk SEO editing." It centralizes SEO management across every content type (products, recipes, blog posts, static pages) via a single reusable `SeoFieldsPanel` component that STORY-040 (Products), STORY-043 (Recipes), and STORY-044 (Blog) embed in their own edit forms rather than building independent SEO fields.

## Acceptance Criteria
- [ ] A shared, embeddable SEO field editor (meta title, meta description, canonical URL, OG title/image/description, robots index/follow directives, focus keyword) is available both inline on each content module's edit screen and centrally via a searchable list of all pages with their SEO status
- [ ] A redirect manager supports creating/editing/deleting 301/302 redirects, bulk import via CSV, and conflict detection (duplicate source paths, redirect chains/loops)
- [ ] Structured data (schema.org) management provides a default JSON-LD template per content type (Product, Recipe, Article/BlogPosting, Organization) with field mapping, plus a per-page override
- [ ] Bulk SEO editing filters pages missing a meta title/description or with duplicate titles, and can bulk-apply a templated pattern (e.g. a title formula) across the filtered set
- [ ] Each page shows SEO health indicators (missing meta description, title length out of recommended range, missing hero image alt text, no canonical set) as a checklist/score
- [ ] `sitemap.xml` and `robots.txt` stay automatically in sync with published content and with any noindex/redirect settings

## Tasks
- [ ] **Database:** `SeoMeta` (polymorphic: entityType, entityId, metaTitle, metaDescription, ogImageId, robotsIndex, robotsFollow, canonicalUrl, focusKeyword), `Redirect` (sourcePath, destinationPath, statusCode, active), `SchemaTemplate` (entityType, jsonLdTemplate).
- [ ] **API:** `/api/admin/seo/pages` (list with health status), `/api/admin/seo/[entityType]/[entityId]`, `/api/admin/seo/redirects`, `/api/admin/seo/bulk-edit`, `/api/admin/seo/sitemap` (regeneration trigger).
- [ ] **Service/Backend:** `seo.service.ts` (health scoring rules), `redirect.service.ts` (loop/conflict detection), `sitemap.service.ts` (regeneration on publish events).
- [ ] **Frontend:** `src/app/(admin)/seo/page.tsx` with Pages / Redirects / Schema Templates / Bulk Edit tabs, plus a reusable `SeoFieldsPanel` component embedded inside the Products (STORY-040), Recipes (STORY-043), and Blog (STORY-044) edit forms.
- [ ] **Validation:** Zod schemas for meta field length limits, redirect path format, and a loop-detection guard rejecting any redirect that would create a cycle.
- [ ] **Testing:** Unit tests for redirect loop/conflict detection and the SEO health scoring rules; e2e test bulk-editing a filtered set of pages and confirming meta titles update; e2e test that a created redirect returns the correct HTTP status code.
- [ ] **Documentation:** Document the polymorphic `SeoMeta` entityType values and how a new content type registers into the console, and the `SeoFieldsPanel` embedding contract for other stories to follow.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-040 (Products), STORY-043 (Recipes), STORY-044 (Blog) — these stories embed the shared `SeoFieldsPanel` this story delivers rather than building their own SEO fields

## References
- `docs/blueprint.md` Section 7 ("SEO Console" bullet)
- `docs/blueprint.md` Section 6 (SEO standards)
