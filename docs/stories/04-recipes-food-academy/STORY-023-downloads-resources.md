# STORY-023: Downloads & Resources

**Status:** Done (2026-09-27) — see `docs/architecture-decisions.md`'s 2026-09-27 entry for the full write-up (file storage approach, `@react-pdf/renderer` choice, atomic `downloadCount` increment, the Button-as-link accessibility fix). This file's own Status/checkboxes were not flipped at the time; synced 2026-10-04 after being rediscovered already-complete while picking up the next item in the confirmed build sequence.
**Epic:** 04 — Recipes & Food Academy
**Priority:** Low
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast

## User Story
As a Home Cook, I want to download a printable PDF version of a recipe card, so that I can keep it in my kitchen without needing a screen.
As a Gourmet Food Enthusiast, I want to browse a resources library of guides (e.g. nutrition guides, ingredient glossaries), so that I can access reference material beyond individual recipes and articles.
As a Busy Professional, I want a single place to find downloadable resources, so that I don't have to hunt through recipe and Food Academy pages one by one.

## Description
This story adds a lightweight downloadable-assets capability to the content platform, covering `docs/blueprint.md` Section 5 ("Content: ...downloads") and Section 9 item 4 ("Recipes & Food Academy... downloads"). It provides a `/downloads` (or `/resources`) library listing downloadable PDFs/guides (printable recipe cards, nutrition guides, ingredient glossaries, etc.), a simple download-serving mechanism, and basic download tracking (count per asset). It also covers generating a printable recipe-card PDF for an individual recipe, complementing (not replacing) the browser print view already built in STORY-018.

## Acceptance Criteria
- [x] `/downloads` renders a listing of published downloadable resources as a card grid: title, thumbnail/cover image, file type/size, category, and a "Download" button
- [x] Resources are categorized (e.g. Recipe Cards, Nutrition Guides, Ingredient Guides, Brand/Company resources) via a `DownloadCategory` model, filterable from the listing
- [x] Clicking "Download" serves the file directly (or via a signed/short-lived URL if stored in cloud storage) without requiring login, unless a specific resource is explicitly marked as requiring authentication (e.g. a loyalty-exclusive guide — supported by the model but not required for launch content)
- [x] Each download increments a `downloadCount` counter for that resource, recorded server-side (not purely client-side, so it cannot be trivially skipped/inflated by disabling JS)
- [x] Only resources with `status = PUBLISHED` are listed or servable; requesting a draft/unpublished resource's file URL directly returns 404/403
- [x] Individual recipe detail pages (STORY-018) gain a "Download printable recipe card (PDF)" action that generates or serves a PDF version of that recipe (ingredients + method, respecting the brand's visual identity), distinct from the browser print stylesheet already built in STORY-018
- [x] File size and type are shown to the customer before download (e.g. "PDF · 1.2 MB") so expectations are set, especially on mobile/limited data connections
- [x] Broken/missing file references fail gracefully with a clear error state rather than a broken download or generic 500
- [x] Downloads listing and detail cards are fully responsive and meet WCAG 2.1 AA (descriptive link text/labels for downloads, not just a bare icon)
- [x] Meets Lighthouse >95; resource thumbnails are optimized via Next/Image

## Tasks

- [x] **Database:**
  - [x] Define `DownloadResource` model: `id`, `slug`, `title`, `description`, `thumbnailUrl`, `fileUrl`, `fileType` (enum or string, e.g. PDF), `fileSizeBytes`, `categoryId`, `requiresAuth` (boolean, default false), `status` (DRAFT/PUBLISHED/ARCHIVED), `downloadCount`, `createdAt`, `updatedAt`
  - [x] Define `DownloadCategory` model: `id`, `name`, `slug`, `sortOrder`
  - [x] Add index on `DownloadResource.status`, `DownloadResource.categoryId`, `DownloadResource.slug` (unique)
  - [x] Migration + seed data: a category set and 6–10 sample resources (mix of recipe-card PDFs and guide PDFs), using placeholder files/URLs suitable for local dev

- [x] **API:**
  - [x] `GET /api/downloads` — list endpoint with `category` filter and pagination, `PUBLISHED` only
  - [x] `GET /api/downloads/[slug]` — resource detail (for a dedicated detail view, if used) or inline metadata on the listing card
  - [x] `GET /api/downloads/[slug]/file` — serves the file (redirect to a signed URL, or streams from storage) and atomically increments `downloadCount`; enforces the `requiresAuth` flag via session check; returns 404 for unpublished/missing resources
  - [x] `GET /api/recipes/[slug]/pdf` — generates/serves the printable recipe-card PDF for a given recipe (reuses recipe data from STORY-018's service, not a duplicate data source)

- [x] **Service/Backend:**
  - [x] `download.service.ts`: `listResources(filters, pagination)`, `listCategories()`, `getResourceBySlug(slug)`, `recordDownload(resourceId)` (atomic increment), `resolveFileAccess(resourceId, session)` (enforces `requiresAuth`)
  - [x] `download.repository.ts`: Prisma queries (only file importing Prisma directly for this module)
  - [x] `recipe-pdf.service.ts` (or extend `recipe.service.ts`): builds a PDF document from recipe data (server-side PDF generation library, e.g. a React-PDF-style renderer or headless HTML-to-PDF conversion) styled per the Oristor design system (brand colors/fonts from `docs/blueprint.md` Section 2)

- [x] **Frontend:**
  - [x] `src/app/(storefront)/downloads/page.tsx` — Server Component listing page with category filter
  - [x] `src/components/storefront/downloads/DownloadCard.tsx`, `DownloadCategoryFilter.tsx`, `DownloadButton.tsx` (handles the click → hits `/api/downloads/[slug]/file` → triggers browser download)
  - [x] Add a "Download PDF" button to the STORY-018 recipe detail page's print/share bar, alongside the existing browser print action
  - [x] Graceful error state component for broken/missing file references

- [x] **Validation:**
  - [x] Zod schema for `/api/downloads` list query params (category, pagination bounds)
  - [x] Validate `requiresAuth` enforcement path with a test resource to confirm unauthenticated access is correctly blocked

- [x] **Testing:**
  - [x] Unit tests for `recordDownload` atomicity (concurrent increments don't lose counts) — can be tested at the repository/query level (e.g. `increment` operation) rather than requiring true concurrency simulation
  - [x] Unit tests confirming unpublished resources are excluded from listing and return 404 on direct file access
  - [x] Unit tests confirming `requiresAuth` resources reject unauthenticated file requests
  - [x] Playwright e2e: browse `/downloads`, filter by category, click download and confirm the file request succeeds and the listed download count increases; generate/download a recipe PDF from a recipe detail page
  - [x] Accessibility test pass (axe) on the downloads grid and download buttons/links

- [x] **Documentation:**
  - [x] Document the file storage approach (local/public dir for dev vs. cloud storage + signed URLs for production) in `docs/architecture-decisions.md`
  - [x] Document the PDF generation approach chosen for recipe cards (library, styling constraints) so it can be reused if PDF export is later added to Food Academy guides or blog posts

## Dependencies
- STORY-001 (Project Foundation Setup)
- STORY-002 (Design System & Theming) — recipe PDF and download cards should reflect brand colors/typography
- STORY-003 (Global Layout & Responsive Framework)
- STORY-018 (Recipe Detail Page) — recipe-card PDF generation reuses the recipe data/service from this story and adds a download action to its print/share bar

## Out of Scope
- Download resource authoring/upload UI (belongs to a future admin Media Library / content module, Epic 07)
- Rich analytics/reporting on download trends beyond a simple per-resource counter (belongs to Enterprise Platform analytics, Epic 07/STORY-059)
- DRM, watermarking, or per-user download limits
- Generating PDFs for Food Academy or Blog content (recipe cards only for this story; extend later if requested)

## References
- `docs/blueprint.md` Section 5 (Content: downloads)
- `docs/blueprint.md` Section 9 item 4 (Recipes & Food Academy)
- `docs/blueprint.md` Section 2 (Brand Identity — for PDF styling)
- `docs/folder-structure.md`
