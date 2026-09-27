# STORY-023 Downloads & Resources — Design Decisions

Spec for a lightweight downloadable-assets library (`/downloads`: recipe
cards, nutrition guides, ingredient glossaries) plus a "download printable
recipe card (PDF)" action on the recipe detail page. Unlike STORY-022, this
story has **no shipped precedent to adapt** — it is the first feature in this
codebase that (a) generates a PDF and (b) serves/tracks a binary file
download. Every decision below is new, not an application of an existing
pattern, except where explicitly noted (the `downloadCount` atomic-increment
shape reuses `Recipe.viewCount`'s exact precedent, and the listing page's
URL-driven filter state reuses the Blog hub's pattern).

**Ground rule:** keep this story's surface area to what its own ACs ask
for. No cloud-storage integration, no admin authoring UI (explicitly out of
scope — Epic 07's future Media Library), no PDF caching layer, no detail
page beyond the listing card. Confirmed open items in `docs/blueprint.md`
Section 10 (hosting/cloud provider) are not blocking this story — file
storage for this story is local, by design, with the swap point documented
for later.

## 1. Storage: local `public/downloads/`, not cloud storage

No cloud storage provider (S3/Cloudinary/etc.) is decided anywhere in this
project — `docs/blueprint.md` Section 10 lists "hosting/cloud provider
specifics" as an open item, and `docs/architecture-decisions.md`'s STORY-020
entry already deferred `ReviewImage` uploads for the same reason. Every
existing image asset in this codebase (`Recipe.heroImage`,
`Product.imageUrl`, etc.) is a plain string path into `public/images/` — there
is no asset-storage abstraction to plug into yet.

This story follows that same existing convention: `DownloadResource.fileUrl`
and `.thumbnailUrl` are plain relative paths into `public/downloads/` and
`public/images/` respectively, served by Next.js's built-in static file
handling. The AC's own wording ("or via a signed/short-lived URL if stored
in cloud storage") is written as an *option*, not a requirement — this spec
takes the plain-local-file path. `docs/architecture-decisions.md` will note
the swap point explicitly: when a cloud provider is chosen (STORY-041 or a
future infra story), `fileUrl` becomes a full external URL and
`/api/downloads/[slug]/file` starts streaming from it instead of `fs`, with
no schema change required.

## 2. PDF generation: `@react-pdf/renderer`, not a headless browser

No PDF library exists in this codebase yet. Two real options were
considered: `@react-pdf/renderer` (pure-JS, renders a React component tree
directly to a PDF byte stream, no browser process) vs. headless Chromium
print-to-PDF via Playwright (already a devDependency, but only ever used
inside `tests/e2e` — a repo-wide grep confirms zero production usage).

Chosen: **`@react-pdf/renderer`**. Reasons: it needs no browser binary in
production (this project's hosting target is still an open item per
blueprint Section 10 — a headless-Chromium requirement would constrain that
decision for an unrelated story); it renders from structured data (the same
`getRecipeBySlug` result STORY-018 already fetches) as a purpose-built
one-page layout, not a scaled-down webpage; and it keeps the new production
dependency footprint to one small library instead of a full browser
runtime. The trade-off, accepted deliberately: `@react-pdf/renderer` has its
own `StyleSheet`/Flexbox-like styling API — none of the app's Tailwind
classes or `print:hidden` CSS (STORY-018's browser-print mechanism) carry
over. This is a second, independent rendering of the recipe, not a
reuse of STORY-018's print view — which is why the AC calls it
"complementing, not replacing" the existing Print button.

## 3. Data model

```prisma
enum DownloadResourceStatus {
  Draft
  Published
  Archived
}

model DownloadCategory {
  id        String             @id @default(cuid())
  name      String
  slug      String             @unique
  sortOrder Int                @default(0)
  resources DownloadResource[]
}

model DownloadResource {
  id            String                 @id @default(cuid())
  slug          String                 @unique
  title         String
  description   String?
  thumbnailUrl  String
  fileUrl       String
  fileType      String                 // e.g. "PDF" — a plain string, not an enum: STORY-023 only ever produces PDFs today, but the AC's "file type/size" display implies more may be added later without a migration.
  fileSizeBytes Int
  categoryId    String
  category      DownloadCategory       @relation(fields: [categoryId], references: [id])
  requiresAuth  Boolean                @default(false)
  status        DownloadResourceStatus @default(Draft)
  downloadCount Int                    @default(0)
  createdAt     DateTime               @default(now())
  updatedAt     DateTime               @updatedAt

  @@index([status, categoryId])
}
```

`DownloadResourceStatus` uses PascalCase values (`Draft`/`Published`/
`Archived`), matching this codebase's established enum-naming correction
(every other status enum — `RecipeStatus`, `BlogPostStatus`,
`RecipeReviewStatus` — already made this same correction from the story
docs' SCREAMING_CASE). No separate `RecipePdfDownload` tracking table: a
generated recipe PDF is not a `DownloadResource` row (see decision #7) and
has no counter of its own — the AC only requires counting for the
`/downloads` library's resources, not per-recipe PDF generations.

## 4. API surface — no standalone resource-detail endpoint

```
GET  /api/downloads                — list, ?category, ?page/?pageSize, Published only
GET  /api/downloads/[slug]/file    — serves the file, atomically increments downloadCount
GET  /api/recipes/[slug]/pdf       — generates and serves the recipe-card PDF
```

The story's task list also proposes `GET /api/downloads/[slug]` "for a
dedicated detail view, if used." No AC asks for a resource detail page —
only a card grid with a Download button — so this spec drops it. Adding an
unused route is exactly the kind of surface YAGNI rules out; if a detail
page is wanted later, the listing endpoint's per-item shape already has
every field such a page would need.

Every route follows this codebase's established `auth()`-where-needed →
typed-error-to-HTTP-status convention (`src/lib/api/responses.ts`'s
`unauthorizedResponse()`/`validationErrorResponse()`), the same one
`recipe-review-responses.ts` and `review-responses.ts` already use.

## 5. File serving: read-and-stream with `Content-Disposition`, not a redirect

`/api/downloads/[slug]/file` cannot be a redirect to the static
`public/downloads/...` URL: a redirect hands control to Next's static file
server, which can't be made to set `Content-Disposition: attachment` (so
the browser would open the PDF inline rather than download it) and would
skip this route entirely on the redirected request — meaning the
`requiresAuth` check and the `downloadCount` increment would only run on the
*first* hop, not reliably. Instead the route:

1. Looks up the resource by slug; 404 if missing or `status !== "Published"`.
2. If `requiresAuth`, checks `auth()`'s session; 401 if absent.
3. Reads the file from `public/<fileUrl>` via `fs.readFile`; a missing file
   on disk (metadata/file drift) returns a clean 404 with a message — never
   an unhandled exception surfacing as a generic 500 (the AC's "fail
   gracefully" requirement).
4. Increments `downloadCount` (decision #6), then returns the bytes with
   `Content-Type` set from `fileType` and
   `Content-Disposition: attachment; filename="<slug>.pdf"`.

This same shape is exactly what decision #1's later cloud-storage swap
would change internally (step 3 becomes a `fetch` of the external URL
instead of `fs.readFile`) without touching steps 1/2/4 or the route's
public contract.

## 6. `downloadCount`: atomic raw-SQL increment, mirroring `Recipe.viewCount`

```typescript
// download.repository.ts
export async function incrementDownloadCount(resourceId: string): Promise<void> {
  await prisma.$executeRaw`UPDATE "DownloadResource" SET "downloadCount" = "downloadCount" + 1 WHERE "id" = ${resourceId}`;
}
```

This is a direct copy of the established pattern from
`recipe.repository.ts`'s `incrementRecipeViewCount` — a raw `$executeRaw`
UPDATE rather than `prisma.downloadResource.update({ data: { downloadCount:
{ increment: 1 } } })`, specifically so the increment doesn't also bump
`@updatedAt` (a download is not a content edit, exactly the same reasoning
the `viewCount` precedent's own doc comment gives). This is the only
existing atomic-counter precedent in the codebase and is reused verbatim in
shape, not just in spirit.

## 7. Recipe PDF: generated fresh per request, no persistence or caching

`recipe-pdf.service.ts` calls the existing `getRecipeBySlug` (STORY-018) —
no duplicate data-fetching path — and renders a `@react-pdf/renderer`
document on every request to `/api/recipes/[slug]/pdf`. No generated PDF is
written to disk or cached: `@react-pdf/renderer` render time for a one-page
structured document is small, and caching would add invalidation complexity
(a recipe's ingredients/servings can change) for no measured benefit. If
this ever needs to change (e.g. under real load), the route's contract
(`GET` → PDF bytes) doesn't change — only the service's internals would
gain a cache layer.

Fonts: the web app loads Cormorant Garamond/Inter via `next/font/google`
(a build-time CSS mechanism `@react-pdf/renderer` cannot consume — it needs
actual `.ttf` files registered via `Font.register()`). This story adds the
two font files (Cormorant Garamond, Inter — both OFL-licensed, freely
embeddable) under `public/fonts/` and registers them once at
`recipe-pdf.service.ts` module load, using the same hex values from
`docs/blueprint.md` Section 2's color table for the PDF's `StyleSheet`.

## 8. Seed content: real generated PDFs, not renamed placeholder files

No admin authoring UI exists yet (out of scope, deferred to Epic 07's Media
Library), so seed `DownloadResource` rows need real files to point at.
`prisma/seed-downloads.ts` generates a handful of simple one-page PDFs
(title + description, styled with the same brand tokens) using the same
`@react-pdf/renderer` this story already adds — not fake `.txt` files
renamed to `.pdf` — and writes them to `public/downloads/` once, the same
way `prisma/seed-recipes.ts` et al. reference pre-existing files rather than
generating images at seed time. Thumbnails reuse existing images already
under `public/images/`, the same reuse-over-duplicate-assets approach
`prisma/seed.ts` already takes for other seeded content.

## 9. Frontend structure

- `src/app/(storefront)/downloads/page.tsx` — Server Component, `?category`
  filter carried in the URL (searchParams), mirroring the Blog hub's
  (STORY-021) and Recipe Centre's (STORY-017) URL-driven filter convention
  — a shareable/bookmarkable listing URL, not local component state (that
  convention is reserved for a detail page's own review/comment list, per
  STORY-022 decision #9's "Correction" note).
- `DownloadCard` — thumbnail (`next/image`), title, category, a formatted
  "PDF · 1.2 MB" size string (`fileSizeBytes` formatted client-side or at
  render time — no new dependency needed for a single division+round), and
  the download link.
- `DownloadCategoryFilter` — chip nav, mirroring the Blog hub's tag/author
  chip pattern (`buildBlogChipHref`'s shape, adapted for one filter
  dimension instead of two).
- `DownloadButton` — a plain `<a href="/api/downloads/[slug]/file"
  download>`, not a client-side click handler: the browser's native download
  behavior handles the common case with no JS and no double round-trip
  (fetch-then-blob-then-trigger). A broken/missing file (decision #5's 404
  path) is surfaced by the browser's own failed-navigation/download UI,
  which satisfies "fail gracefully" without extra client code; no separate
  inline error component is needed for this path since there is no
  intermediate client-side state to show it in.
- Recipe detail page: a "Download PDF" button added into
  `RecipePrintShareBar` (STORY-018) next to the existing Print button,
  linking to `/api/recipes/[slug]/pdf` the same plain-`<a>` way.

## 10. Security posture

`requiresAuth` is enforced entirely server-side in
`/api/downloads/[slug]/file` (decision #5, step 2) — the listing page may
still show a `requiresAuth` resource's card to a logged-out visitor (the AC
doesn't ask for it to be hidden, only for the *file* to require login), but
clicking Download without a session gets a 401, never a silently-served
file. No route accepts a client-supplied resource id in place of a
slug-based lookup, and no route trusts a client-supplied `downloadCount` or
file path. `/api/recipes/[slug]/pdf` requires no auth (recipe pages are
already fully public).

## 11. Accessibility floor

Every download link/button gets a descriptive accessible name that
includes the resource, format, and size ("Download Sri Lankan Chicken Curry
recipe card, PDF, 1.2 MB") rather than a bare icon or generic "Download" —
directly satisfying the AC's explicit WCAG note. The category chip nav
reuses the Blog hub's already-accessible pattern (real `<nav>`/`<a>`
elements, not `<div onClick>`).

## 12. Testing plan

- Unit: `incrementDownloadCount`'s atomicity (repository-level, asserting
  the raw-SQL shape and resulting value — matching how the `Recipe.viewCount`
  precedent itself is tested, not a true-concurrency simulation); unpublished
  resources excluded from listing and 404 on direct file access;
  `requiresAuth` resources reject an unauthenticated file request; missing
  file server-side degrades to a clean error, not a 500; category filtering
  and pagination.
- Unit: `recipe-pdf.service.ts` renders successfully for a recipe with and
  without optional fields (no dietary tags, no reviews yet) and produces a
  non-empty `application/pdf` buffer — a byte-for-byte PDF content
  assertion is impractical and not attempted.
- E2e: browse `/downloads`, filter by category, download a resource and
  confirm its listed count increases on reload; download a recipe PDF from
  the recipe detail page and confirm a `application/pdf` response.
- Accessibility (axe): the downloads grid and category filter.

## 13. Documentation

`docs/architecture-decisions.md` gets an entry covering: the local
`public/downloads/`-for-now storage decision and its documented cloud-storage
swap point (decision #1); the `@react-pdf/renderer` choice over headless
Chromium and why (decision #2); the `downloadCount` atomic-increment
pattern explicitly flagged as reusable (the same way the `Recipe.viewCount`
precedent already was) for STORY-047/STORY-036's future invoice/packing-slip
PDF stories, which reference PDF generation but currently have no
implementation of their own.
