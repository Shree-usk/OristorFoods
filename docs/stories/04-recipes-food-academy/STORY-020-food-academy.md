# STORY-020: Food Academy

**Status:** Done
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
- [x] `/food-academy` renders a hub landing page with featured/highlighted content and a browsable grid of all published Food Academy entries — `src/app/(storefront)/food-academy/page.tsx`: `listFeaturedEntries()` renders a featured grid, `listEntries(query)` renders the full grid.
- [x] Food Academy entries are categorized by topic (e.g. Ingredients, Techniques, Culture & Heritage, Spice Guide) via a `FoodAcademyCategory` model, shown as filterable tabs/chips on the listing — `FoodAcademyCategory` model (`prisma/schema.prisma:711-719`), category chips rendered as `<Link>`s with `aria-current` in `page.tsx:50-68`; seeded with exactly this 4-category set (`prisma/seed-food-academy.ts:11-31`).
- [x] Entries support a `contentType` distinction (e.g. Article, Guide, Course) rendered as a badge on the card and used as an additional filter — `FoodAcademyContentType` enum; `Badge` on `food-academy-card.tsx:19`; contentType filter chips in `page.tsx:69-80`; `tests/unit/food-academy-card.test.tsx` and `tests/e2e/food-academy.spec.ts` ("clicking a content-type chip...") cover both.
- [x] `/food-academy/[slug]` renders a single entry: title, hero image, rich-text/structured body content, estimated reading/completion time, author/contributor attribution, and related entries — all present in `src/app/(storefront)/food-academy/[slug]/page.tsx:48-100` (title, hero `Image`, `MarkdownContent` body, `readingTimeMinutes`, `authorName`, related-entries grid).
- [x] Multi-section/multi-lesson entries (i.e. "courses") support an ordered list of sections with in-page navigation (e.g. a table of contents / sticky section nav) distinct from a single flat article body — `FoodAcademySection` ordered by `sectionNumber` (repository `orderBy: { sectionNumber: "asc" }`), rendered via `FoodAcademySectionNav` (sticky, `[slug]/page.tsx:67-86`); `tests/unit/food-academy-repository.test.ts` ("returns sections in order...") and the e2e Course-page tests cover this.
- [x] Food Academy entries can optionally reference related recipes (linking into STORY-018 detail pages) and related products (linking into the Product Catalogue, STORY-009/011) — `FoodAcademyRecipeRef`/`FoodAcademyProductRef`, rendered via `RelatedRecipesBlock`/`RelatedProductsBlock`; e2e tests confirm the recipe link lands on `/recipes/[slug]` and the product link on `/products/[slug]`.
- [x] Only `PUBLISHED` entries are ever returned to the storefront; draft/review-state entries are excluded regardless of filter — every read query in `food-academy.repository.ts` hardcodes `status: "Published"` and the list query strips any caller-supplied `status` before composing `where` (can't be widened by a caller); covered by repository, service, route, and e2e tests (Draft entry never appears; `/food-academy/[draft-slug]` 404s).
- [ ] Listing supports pagination and a "related/next" recommendation at the bottom of each detail page — **partially delivered.** `listEntries`/`GET /api/food-academy` fully support `page`/`pageSize` and return `{total, page, pageSize}`, and the hub page's Zod parsing passes a `page` param through from the URL (`foodAcademyListQuerySchema`, `page.tsx:24-28`) — so `/food-academy?page=2` works if typed manually. But `src/app/(storefront)/food-academy/page.tsx` renders **no pagination UI** (no prev/next links, no page-number control) — a user has no way to reach page 2 from the hub page itself. The "related/next recommendation at the bottom of each detail page" half of this AC **is** delivered (`relatedEntries` grid, `[slug]/page.tsx:91-100`). Leaving unchecked: the API/service contract is done, but the hub page's pagination control is a real gap for a future story/task, not something to silently mark done.
- [x] Pages include appropriate structured data (schema.org `Article`/`LearningResource` where applicable) and meta tags for SEO — `FoodAcademyJsonLd` emits `Article` for Article/Guide and `LearningResource` for Course (`food-academy-json-ld.tsx`); hub reuses `ItemListJsonLd`; both pages have `generateMetadata`/static `metadata` with `alternates.canonical`.
- [x] Listing and detail pages are fully responsive and meet WCAG 2.1 AA (heading hierarchy, section nav keyboard-operable, sufficient contrast) — responsive grid breakpoints (`sm:`/`xl:` grid-cols) throughout; `tests/e2e/food-academy.spec.ts` axe scans report zero violations on the hub, an Article/Guide detail page, and a Course detail page; section nav links are real `<a href="#...">` anchors confirmed keyboard-focusable by e2e ("a Course section nav link is keyboard-operable...").
- [ ] Meets Lighthouse >95 with server-rendered initial content _(not measured)_

## Tasks

- [x] **Database:**
  - [x] Define `FoodAcademyEntry` model: `id`, `slug`, `title`, `heroImageUrl`, `contentType` (enum: ARTICLE/GUIDE/COURSE), `categoryId`, `summary`, `bodyContent` (rich text/markdown for simple articles), `readingTimeMinutes`, `authorName`/`authorId`, `status`, `publishedAt`, `createdAt`, `updatedAt` — `prisma/schema.prisma:721-752`, all fields present except `authorId`: **deliberately omitted**, not forgotten — there is no admin-auth/User model in the codebase yet (STORY-038 is still Draft), so `authorName: String?` is a plain byline string for now (documented in `docs/superpowers/specs/2026-09-26-food-academy-design.md` decision 2, and reused from `CookingTip`'s identical precedent). Enum values are `Article`/`Guide`/`Course` (PascalCase), not the story text's `ARTICLE`/`GUIDE`/`COURSE` — same naming-convention correction STORY-019 already made for `VideoProvider`.
  - [x] Define `FoodAcademyCategory` model: `id`, `name`, `slug`, `description`, `sortOrder` — `prisma/schema.prisma:711-719` (also adds `status: ContentStatus`, reusing the existing Active/Inactive taxonomy pattern).
  - [x] Define `FoodAcademySection` model for course-style multi-section entries: `id`, `entryId`, `sectionNumber`, `title`, `bodyContent`, `imageUrl` (nullable) — `prisma/schema.prisma:754-764`, `@@unique([entryId, sectionNumber])`.
  - [x] Define join tables `FoodAcademyRecipeRef` (entry ↔ `Recipe`) and `FoodAcademyProductRef` (entry ↔ `Product`) for optional cross-links — `prisma/schema.prisma:766-786`.
  - [x] Migration + seed data: category set, several standalone articles, and at least one multi-section "course" entry with cross-linked recipes/products — migration `prisma/migrations/20260926090000_add_food_academy`; `prisma/seed-food-academy.ts` seeds 4 categories, 4 standalone Article/Guide entries (one Draft, for exclusion-regression coverage), and one 4-section Course cross-linked to the real seeded recipe `sri-lankan-chicken-curry` and product `roasted-curry-powder-100g`.

- [x] **API:**
  - [x] `GET /api/food-academy` — list endpoint with `category`, `contentType`, `page`/`pageSize` params — `src/app/api/food-academy/route.ts`.
  - [x] `GET /api/food-academy/categories` — category taxonomy — `src/app/api/food-academy/categories/route.ts`.
  - [x] `GET /api/food-academy/[slug]` — single entry detail (with ordered sections, related recipes, related products), `PUBLISHED` only, 404 otherwise — `src/app/api/food-academy/[slug]/route.ts`; `tests/unit/food-academy-route.test.ts` covers 200/404.

- [x] **Service/Backend:**
  - [x] `food-academy.service.ts`: `listEntries(filters, pagination)`, `listCategories()`, `getEntryBySlug(slug)`, `getRelatedEntries(entryId)` — **delivered with a naming difference, checked with a note, not silently**: `listEntries`, `listCategories`, `getEntryBySlug` exist exactly as named (`src/services/food-academy.service.ts`), but there is no separately-exported `getRelatedEntries(entryId)` function — related-entries lookup is inlined inside `getEntryBySlug` (calls `foodAcademyRepository.findRelatedFoodAcademyEntries` directly). The behavior the task describes (related entries resolved and returned) is fully delivered; the specific function signature/name is not. Flagging so a future caller doesn't go looking for a `getRelatedEntries` export that isn't there.
  - [x] `food-academy.repository.ts`: Prisma queries (only file allowed to import Prisma directly for this module), including ordered section fetch and recipe/product ref resolution — confirmed only `food-academy.repository.ts` imports `prisma`/`Prisma` in this module (`src/services/food-academy.service.ts` imports no Prisma types). "Recipe/product ref resolution" is intentionally split from the repository: the repository selects only raw `recipeId`/`productId` (see the architecture-decisions.md entry added in this task), and resolution into full recipe/product data happens one layer up in the service via `getRecipesByIds`/`getProductsByIds` — this is a deliberate layering choice (documented), not an omission.

- [x] **Frontend:**
  - [x] `src/app/(storefront)/food-academy/page.tsx` — hub landing page (Server Component): featured entries + full grid.
  - [x] `src/app/(storefront)/food-academy/[slug]/page.tsx` — detail page with `generateMetadata` and structured data.
  - [ ] `src/components/storefront/food-academy/FoodAcademyCard.tsx`, `FoodAcademyCategoryTabs.tsx`, `FoodAcademyGrid.tsx`, `FoodAcademySectionNav.tsx` (Client Component for sticky/in-page nav), `RelatedRecipesBlock.tsx`, `RelatedProductsBlock.tsx` — **partially delivered as separate components.** `food-academy-card.tsx`, `food-academy-section-nav.tsx` (Client Component, confirmed), `related-recipes-block.tsx`, and `related-products-block.tsx` all exist as named. `FoodAcademyCategoryTabs` and `FoodAcademyGrid` were **not** extracted into their own component files — that markup (category/contentType filter chip `<nav>`s, and the results `<div className="grid...">`) is inlined directly in `page.tsx`. The functionality is fully present and tested via the hub page itself; the specific file-per-component split the task describes is not. Leaving unchecked rather than claiming two files exist that don't.
  - [x] Reuse `RecipeCard` (STORY-017) and product card components (STORY-010) for the cross-link blocks rather than duplicating card markup — **checked with a partial-compliance note, not a blanket pass.** `RelatedProductsBlock` (`related-products-block.tsx`) fully reuses the real `ProductCard` component directly — fully compliant. `RelatedRecipesBlock` (`related-recipes-block.tsx`) does **not** wrap `RecipeCard`; it is a small custom presentation component. This is a deliberate, documented design decision (`docs/superpowers/specs/2026-09-26-food-academy-design.md` §6, "Both branches end with `RelatedRecipesBlock` (reusing `RecipeCard`)..." describes the intent, but the actual constraint is that `getRecipesByIds` returns the minimal `RecipePreview { id, title, slug, imageSrc }` shape reused from `product-detail-extensions.ts`, which doesn't carry the fields `RecipeCard`'s real prop type requires (`categoryName`, `avgRating`, `ratingCount`, etc.) — forcing it through `RecipeCard` would mean fabricating fake data for those fields rather than reusing real recipe data. So: product side fully reuses `ProductCard`; recipe side uses a smaller custom component by deliberate design, not because reuse was skipped or forgotten.

- [x] **Validation:**
  - [x] Zod schema for `/api/food-academy` list query params (`category`, `contentType`, pagination bounds) — `foodAcademyListQuerySchema`, `src/validation/food-academy.schema.ts`; `tests/unit/food-academy-schema.test.ts`.
  - [x] Zod schema validating the `[slug]` route param before service lookup — `foodAcademySlugParamSchema`, used in `src/app/api/food-academy/[slug]/route.ts` before calling `getEntryBySlug`.

- [x] **Testing:**
  - [x] Unit tests for `food-academy.service.ts` filter logic and the "published only" guard — `tests/unit/food-academy-service.test.ts`, `tests/unit/food-academy-repository.test.ts`.
  - [x] Unit tests confirming section ordering is preserved for course-type entries — `tests/unit/food-academy-repository.test.ts` ("returns sections in order and raw recipe/product ids").
  - [x] Playwright e2e: browse `/food-academy`, filter by category and content type, open a course-type entry and confirm section navigation works, follow a related-recipe link into `/recipes/[slug]` — all present in `tests/e2e/food-academy.spec.ts`, plus a related-product-link test into `/products/[slug]` that the task list didn't explicitly ask for.
  - [x] Accessibility test pass (axe) on the hub landing page and a multi-section course detail page — `tests/e2e/food-academy.spec.ts` axe scans on the hub, an Article/Guide page, *and* the Course page (superset of what was asked).

- [x] **Documentation:**
  - [x] Document the `ARTICLE`/`GUIDE`/`COURSE` content-type distinction and section model in `docs/architecture-decisions.md` so it stays consistent with whatever admin authoring tooling is later built for Food Academy content — added in this task (`## 2026-09-26 — STORY-020 Food Academy`).
  - [x] Document the `FoodAcademyRecipeRef`/`FoodAcademyProductRef` cross-link pattern for reuse by future content types (e.g. Blog, STORY-021) — added in this task, same entry.

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
