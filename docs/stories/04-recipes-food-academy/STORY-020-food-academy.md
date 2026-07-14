# STORY-020: Food Academy

**Status:** Draft
**Epic:** 04 — Recipes & Food Academy
**Priority:** Medium
**Persona(s):** Home Cook, Sri Lankan Expat, Gourmet Food Enthusiast

## User Story
As a Sri Lankan Expat, I want to read guides about authentic Sri Lankan ingredients and cooking techniques, so that I can understand and recreate dishes from home with confidence.
As a Gourmet Food Enthusiast, I want to browse structured courses/articles about Sri Lankan food culture, so that I can deepen my culinary knowledge beyond individual recipes.
As a Home Cook, I want a Food Academy hub I can browse by topic, so that I can learn techniques that make me a better cook.

## Description
This story builds the "Food Academy" educational content hub named explicitly in `docs/blueprint.md` Section 4 (primary nav) and Section 9 item 4 ("Recipes & Food Academy... Done when customers can learn, cook, and engage with content"). It is a distinct content type from Recipes and Blog: structured educational content (courses, articles, guides) about Sri Lankan food, ingredients, and techniques, reinforcing the brand's "Digital Customer Experience" and "Authentic Sri Lankan Heritage" pillars (Section 1). This story covers the listing and detail pages only; content is authored via the admin console (Epic 07).

## Acceptance Criteria
- [ ] `/food-academy` renders a hub landing page with featured/highlighted content and a browsable grid of all published Food Academy entries
- [ ] Food Academy entries are categorized by topic (e.g. Ingredients, Techniques, Culture & Heritage, Spice Guide) via a `FoodAcademyCategory` model, shown as filterable tabs/chips on the listing
- [ ] Entries support a `contentType` distinction (e.g. Article, Guide, Course) rendered as a badge on the card and used as an additional filter
- [ ] `/food-academy/[slug]` renders a single entry: title, hero image, rich-text/structured body content, estimated reading/completion time, author/contributor attribution, and related entries
- [ ] Multi-section/multi-lesson entries (i.e. "courses") support an ordered list of sections with in-page navigation (e.g. a table of contents / sticky section nav) distinct from a single flat article body
- [ ] Food Academy entries can optionally reference related recipes (linking into STORY-018 detail pages) and related products (linking into the Product Catalogue, STORY-009/011)
- [ ] Only `PUBLISHED` entries are ever returned to the storefront; draft/review-state entries are excluded regardless of filter
- [ ] Listing supports pagination and a "related/next" recommendation at the bottom of each detail page
- [ ] Pages include appropriate structured data (schema.org `Article`/`LearningResource` where applicable) and meta tags for SEO
- [ ] Listing and detail pages are fully responsive and meet WCAG 2.1 AA (heading hierarchy, section nav keyboard-operable, sufficient contrast)
- [ ] Meets Lighthouse >95 with server-rendered initial content

## Tasks

- [ ] **Database:**
  - [ ] Define `FoodAcademyEntry` model: `id`, `slug`, `title`, `heroImageUrl`, `contentType` (enum: ARTICLE/GUIDE/COURSE), `categoryId`, `summary`, `bodyContent` (rich text/markdown for simple articles), `readingTimeMinutes`, `authorName`/`authorId`, `status`, `publishedAt`, `createdAt`, `updatedAt`
  - [ ] Define `FoodAcademyCategory` model: `id`, `name`, `slug`, `description`, `sortOrder`
  - [ ] Define `FoodAcademySection` model for course-style multi-section entries: `id`, `entryId`, `sectionNumber`, `title`, `bodyContent`, `imageUrl` (nullable)
  - [ ] Define join tables `FoodAcademyRecipeRef` (entry ↔ `Recipe`) and `FoodAcademyProductRef` (entry ↔ `Product`) for optional cross-links
  - [ ] Migration + seed data: category set, several standalone articles, and at least one multi-section "course" entry with cross-linked recipes/products

- [ ] **API:**
  - [ ] `GET /api/food-academy` — list endpoint with `category`, `contentType`, `page`/`pageSize` params
  - [ ] `GET /api/food-academy/categories` — category taxonomy
  - [ ] `GET /api/food-academy/[slug]` — single entry detail (with ordered sections, related recipes, related products), `PUBLISHED` only, 404 otherwise

- [ ] **Service/Backend:**
  - [ ] `food-academy.service.ts`: `listEntries(filters, pagination)`, `listCategories()`, `getEntryBySlug(slug)`, `getRelatedEntries(entryId)`
  - [ ] `food-academy.repository.ts`: Prisma queries (only file allowed to import Prisma directly for this module), including ordered section fetch and recipe/product ref resolution

- [ ] **Frontend:**
  - [ ] `src/app/(storefront)/food-academy/page.tsx` — hub landing page (Server Component): featured entries + full grid
  - [ ] `src/app/(storefront)/food-academy/[slug]/page.tsx` — detail page with `generateMetadata` and structured data
  - [ ] `src/components/storefront/food-academy/FoodAcademyCard.tsx`, `FoodAcademyCategoryTabs.tsx`, `FoodAcademyGrid.tsx`, `FoodAcademySectionNav.tsx` (Client Component for sticky/in-page nav), `RelatedRecipesBlock.tsx`, `RelatedProductsBlock.tsx`
  - [ ] Reuse `RecipeCard` (STORY-017) and product card components (STORY-010) for the cross-link blocks rather than duplicating card markup

- [ ] **Validation:**
  - [ ] Zod schema for `/api/food-academy` list query params (`category`, `contentType`, pagination bounds)
  - [ ] Zod schema validating the `[slug]` route param before service lookup

- [ ] **Testing:**
  - [ ] Unit tests for `food-academy.service.ts` filter logic and the "published only" guard
  - [ ] Unit tests confirming section ordering is preserved for course-type entries
  - [ ] Playwright e2e: browse `/food-academy`, filter by category and content type, open a course-type entry and confirm section navigation works, follow a related-recipe link into `/recipes/[slug]`
  - [ ] Accessibility test pass (axe) on the hub landing page and a multi-section course detail page

- [ ] **Documentation:**
  - [ ] Document the `ARTICLE`/`GUIDE`/`COURSE` content-type distinction and section model in `docs/architecture-decisions.md` so it stays consistent with whatever admin authoring tooling is later built for Food Academy content
  - [ ] Document the `FoodAcademyRecipeRef`/`FoodAcademyProductRef` cross-link pattern for reuse by future content types (e.g. Blog, STORY-021)

## Dependencies
- STORY-001 (Project Foundation Setup)
- STORY-002 (Design System & Theming)
- STORY-003 (Global Layout & Responsive Framework)
- STORY-009 (Product Catalogue Data Model) — for optional related-product cross-links
- STORY-017 (Recipe Centre & Listing) — for reusing `RecipeCard` and linking related recipes

## Out of Scope
- Food Academy content authoring/editing UI and any admin approval workflow (belongs to a future Epic 07 admin content module)
- Paid/gated courses, quizzes, or completion tracking/certificates (no such requirement in the current blueprint; flag for future scope if requested)
- AI recipe/cooking assistant integration (Epic 08, AI Platform)

## References
- `docs/blueprint.md` Section 4 (Site Structure — primary nav "Food Academy")
- `docs/blueprint.md` Section 5 (Content: Food Academy)
- `docs/blueprint.md` Section 9 item 4 (Recipes & Food Academy)
- `docs/folder-structure.md`
