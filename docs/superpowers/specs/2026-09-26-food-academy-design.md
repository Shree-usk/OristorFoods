# STORY-020 Food Academy — Design Decisions

Resolves the implementation choices `docs/stories/04-recipes-food-academy/STORY-020-food-academy.md`
leaves open, and records the existing codebase patterns this story reuses.

## 1. Body content: real markdown, not plain text

STORY-019's `CookingTip.bodyContent` deliberately stayed plain text
(`whitespace-pre-line`, no markdown dependency) since cooking tips are
short and simple. Food Academy entries are explicitly "structured
educational content" meant to "deepen... culinary knowledge" — longer-form
writing that benefits from headings, lists, and inline emphasis. Decision:
real markdown, rendered via a new shared `<MarkdownContent>` component
(`src/components/shared/markdown-content.tsx`) built on `react-markdown` +
`remark-gfm`. `react-markdown` renders directly to React elements rather
than raw HTML strings, so there is no `dangerouslySetInnerHTML`/sanitizer
boundary to get wrong — raw HTML embedded in markdown source is not
executed by default. This is the first markdown use in the codebase;
`<MarkdownContent>` is intentionally generic so future content types
(Blog, STORY-021) can reuse it rather than each rolling their own renderer.

## 2. Author attribution: free-text `authorName`, no `Author`/`User` model

There is no admin-auth/User-account system in this codebase yet
(STORY-038 Admin Auth & RBAC is still a future Draft story), so there is no
real account to link an entry to. `authorName: String?` is a plain byline
string, admin/seed-supplied. This can grow a `authorId` FK to a real
author-account model later (Epic 07) without a breaking migration — the
column would simply become populated going forward, `authorName` staying
as a display fallback or being backfilled.

## 3. Entry status: simple `Draft → Published`, not Recipe's full editorial workflow

Two precedents exist in this codebase: `RecipeStatus` (`Draft → Review →
Approved → Published → Archived`, a full editorial pipeline) and
`CookingTipStatus` (`Draft → Published`, "admin-authored only, no
moderation pipeline," STORY-019). Food Academy has no dedicated future
admin-workflow story the way Recipes (STORY-043) or Blog (STORY-044) do —
its authoring UI is only vaguely deferred to "a future Epic 07 admin
content module." Decision: follow CookingTip's simpler precedent
(`FoodAcademyEntryStatus { Draft, Published }`) rather than speculatively
building a 5-state workflow with no stated multi-person review process to
back it.

## 4. Data model

```prisma
enum FoodAcademyEntryStatus {
  Draft
  Published
}

enum FoodAcademyContentType {
  Article
  Guide
  Course
}

model FoodAcademyCategory {
  id          String              @id @default(cuid())
  name        String
  slug        String              @unique
  description String?
  sortOrder   Int                 @default(0)
  status      ContentStatus       @default(Active) // reuses the existing Active/Inactive taxonomy pattern (Category, RecipeCategory, DietaryTag)
  entries     FoodAcademyEntry[]
}

model FoodAcademyEntry {
  id                 String                 @id @default(cuid())
  slug               String                 @unique
  title              String
  summary            String
  heroImageUrl       String?
  contentType        FoodAcademyContentType
  categoryId         String
  category           FoodAcademyCategory    @relation(fields: [categoryId], references: [id])
  // Markdown. Required in practice for Article/Guide. There is no
  // create/update API in this story's scope (authoring is explicitly out
  // of scope; entries exist only via seed data, same as CookingTip's
  // createCookingTip being seed-only with no validation schema of its
  // own) — so this is a seed-data/documentation convention, not a runtime
  // check. A future admin-authoring story adds the validation. Optional
  // short intro for Course entries, whose real content lives in `sections`.
  bodyContent        String?
  readingTimeMinutes Int?
  authorName         String?
  isFeatured         Boolean                @default(false) // same pattern as Recipe.isFeatured
  status             FoodAcademyEntryStatus @default(Draft)
  publishedAt        DateTime?
  createdAt          DateTime               @default(now())
  updatedAt          DateTime               @updatedAt

  sections    FoodAcademySection[]
  recipeRefs  FoodAcademyRecipeRef[]
  productRefs FoodAcademyProductRef[]

  @@index([status, publishedAt])
  @@index([status, categoryId])
  @@index([status, contentType])
  @@index([status, isFeatured])
}

model FoodAcademySection {
  id            String           @id @default(cuid())
  entryId       String
  entry         FoodAcademyEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  sectionNumber Int
  title         String
  bodyContent   String           // markdown
  imageUrl      String?

  @@unique([entryId, sectionNumber])
}

model FoodAcademyRecipeRef {
  id       String           @id @default(cuid())
  entryId  String
  entry    FoodAcademyEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  recipeId String
  recipe   Recipe           @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  @@unique([entryId, recipeId])
  @@index([recipeId])
}

model FoodAcademyProductRef {
  id        String           @id @default(cuid())
  entryId   String
  entry     FoodAcademyEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  productId String
  product   Product          @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([entryId, productId])
  @@index([productId])
}
```

`categoryId` is required — category is the primary filterable taxonomy per
the AC, and an "uncategorized" bucket would be awkward in the filter chips.
`FoodAcademySection.sectionNumber` gets a unique-per-entry constraint so
ordering is unambiguous (mirrors `RecipeIngredient`/`RecipeStep`'s
`sortOrder` precedent, named to match the story's own field name). Both ref
tables mirror `CookingTipProductRef`'s shape exactly (cascade delete, unique
compound key, indexed on the far side).

## 5. Repository → Service → API layering

Follows the `cooking-tip.repository.ts` / `cooking-tip.service.ts` pattern
from STORY-019, with two corrections applied from day one rather than
discovered in review (both were real bugs found and fixed late in
STORY-019):

- Every published-facing query composes `status: "Published"` via
  `AND: [{ status: "Published" }, restWhere]`, stripping any caller-supplied
  `status` key first — never a same-key object spread, which would let a
  caller widen the invariant.
- `productRefs` is filtered to `product.status === "Published"` in the
  detail select itself, not left to the frontend to filter.

```typescript
// src/repositories/food-academy.repository.ts
export const foodAcademyCardSelect = {
  id: true, slug: true, title: true, summary: true, heroImageUrl: true,
  contentType: true, readingTimeMinutes: true, isFeatured: true,
  category: { select: { name: true, slug: true } },
} satisfies Prisma.FoodAcademyEntrySelect;

findPublishedFoodAcademyEntries(args: {where, skip, take}): Promise<{rows, total}>
findFeaturedFoodAcademyEntries(limit): Promise<FoodAcademyEntryCardRow[]>
findPublishedFoodAcademyEntryBySlug(slug): Promise<FoodAcademyEntryDetailRow | null>
  // detail select adds: bodyContent, authorName, sections (ordered by sectionNumber),
  // recipeRefs.recipe.{id,title,slug,heroImage}, productRefs (Published-only) .product.{id,slug,name}
findRelatedFoodAcademyEntries({id, categoryId}, limit): Promise<FoodAcademyEntryCardRow[]>
findActiveFoodAcademyCategories(): Promise<{id,name,slug}[]>
createFoodAcademyEntry(data)  // for seeding
```

```typescript
// src/services/food-academy.service.ts
listEntries(query: FoodAcademyListQuery): Promise<FoodAcademyListResult>   // {entries, total, page, pageSize}
listFeaturedEntries(limit = 4): Promise<FoodAcademyEntryCard[]>            // mirrors getFeaturedRecipes
listCategories(): Promise<{id,name,slug}[]>
getEntryBySlug(slug): Promise<FoodAcademyEntryDetail | null>
  // maps sections in order, recipeRefs -> RecipePreview[] (reused from
  // product-detail-extensions.ts, not a new type), productRefs -> {id,slug,name}[],
  // relatedEntries -> FoodAcademyEntryCard[] (same-category, excludes self, Published only)
```

```
GET /api/food-academy              // ?category, ?contentType, ?page, ?pageSize
GET /api/food-academy/categories
GET /api/food-academy/[slug]        // 404 for missing/Draft
```

`food-academy.schema.ts` follows `cookingTipListQuerySchema`'s exact
`.catch()`-everywhere pattern: `category`/`contentType` optional-catch-undefined,
`page`/`pageSize` default-catch.

**Recipe cross-link type reuse:** `FoodAcademyEntryDetail.relatedRecipes`
reuses the existing `RecipePreview { id, title, slug, imageSrc }` type from
`src/services/product-detail-extensions.ts` rather than inventing a new
shape — it's already exactly the right minimal card-link shape.

## 6. Frontend structure

**Hub page (`/food-academy`)** — plain Server Component, the same
"read `searchParams` directly, filter chips as real `<Link>`s, no client
state" pattern that worked for `/recipes/cooking-tips`. `category` and
`contentType` are both small, bounded value sets — no need for Recipe
Centre's heavier client-side `nuqs` filtering. Carries forward, from the
start, three things STORY-019 had to add in a review fix round rather than
get right the first time:
- `aria-current="page"` on the active category/contentType filter chips.
- A visually-hidden `<h2 class="sr-only">` before the results grid, to
  preserve heading order under the page's `<h1>` (card titles render as
  `<h3>`).
- `encodeURIComponent` on every filter value interpolated into an href.

Structure:
```
FoodAcademyPage (Server Component)
├── Featured section (listFeaturedEntries) — new pattern for this codebase;
│   FeaturedRecipes only exists on the homepage today, not inside /recipes
│   itself, but a small featured row here is structurally simple, reusing
│   FoodAcademyCard
├── Category filter chips + ContentType filter chips (plain <Link>s,
│   aria-current, encoded)
└── Grid (listEntries) + pagination links
```

**Detail page (`/food-academy/[slug]`)** — Server Component, branches on
`contentType`:
- **Article/Guide:** renders `bodyContent` through `<MarkdownContent>`.
- **Course:** renders the optional `bodyContent` intro, then each `section`
  in order, each through `<MarkdownContent>`. A sticky in-page table of
  contents (`FoodAcademySectionNav`, the one new Client Component here,
  same "one exception per page" precedent `VideoPlayer` set) — plain anchor
  links to each section's heading, sticky-positioned via CSS, no
  active-section scroll-spy highlighting for v1 (real complexity —
  IntersectionObserver/scroll listeners — for a nice-to-have the AC's
  actual bar, "keyboard-operable," doesn't require; anchor links satisfy
  that for free).
- Both branches end with `RelatedRecipesBlock` (reusing `RecipeCard`),
  `RelatedProductsBlock` (reusing the existing product card component), and
  related-entries (reusing `FoodAcademyCard`).

**`<MarkdownContent>`** — new, shared, Server Component (`react-markdown`
renders fine server-side; no client JS needed). Fixed component-mapping so
headings/lists/links pick up the site's existing typography classes rather
than default browser styling.

## 7. SEO and structured data

Following the `RecipeJsonLd`/`JsonLdScript` pattern exactly — this is the
gap STORY-019's final review found and explicitly deferred for CookingTip;
doing it correctly here from the start rather than deferring again:
- Detail page: `FoodAcademyJsonLd` — `schema.org/Article` for
  Article/Guide, `schema.org/LearningResource` for Course (per the AC's own
  wording).
- Hub page: reuse the existing `ItemListJsonLd` component (already used by
  `/recipes`) for the grid.
- Both pages get `generateMetadata` with `description` +
  `alternates.canonical` (detail: per-slug; hub: base URL, collapsing
  `?category=`/`?contentType=` filter variants for indexing — same call
  made for `/recipes/cooking-tips`).

## 8. Accessibility floor

`aria-current` on active filter chips; correct heading hierarchy (page
`<h1>` → hub's hidden `<h2>` before the grid → card `<h3>`s → detail page's
section `<h2>`s); the section-nav Client Component's links are real
keyboard-focusable `<a href="#...">` elements, not `onClick`-only; every
cross-reference card (related recipe/product/entry) uses real link
semantics, not a `role="button"` div-click.

## 9. Testing plan

- Unit: repository (Published-only + category/contentType filters +
  related-entries + product-status-filter, mirroring every CookingTip test
  from STORY-019), service (mapping, featured-entries, section ordering
  preserved), schema (query param defaults/catches), route handlers
  (200/404).
- `MarkdownContent` gets its own unit test: renders headings/lists/links
  correctly, and a basic XSS-shaped input (e.g. embedded `<script>` or an
  `onerror` attribute in markdown source) renders as literal text, not an
  executed tag/attribute.
- e2e: browse hub, filter by category + contentType, open an Article and a
  Course, confirm the Course's section nav works and is keyboard-operable,
  follow a related-recipe link into `/recipes/[slug]`, follow a
  related-product link into `/products/[slug]`, axe scan on the hub and
  both entry types.
- Seed data: the category set, 2-3 standalone Articles/Guides, at least one
  Course with 3+ sections, cross-linked to at least one real recipe and one
  real product, plus one Draft entry (excluded-from-storefront regression
  coverage).
