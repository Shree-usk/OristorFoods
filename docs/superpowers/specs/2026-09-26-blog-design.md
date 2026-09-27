# STORY-021 Blog — Design Decisions

Spec for the customer-facing Blog: a paginated, tag/author-filterable listing,
a post detail page with embedded recipe/video blocks and a public comment
section. Comment *moderation* (approve/reject/reply/feature/hide) is Epic 07's
concern; this story only ever produces `Pending` comments and renders
`Approved` ones, exactly as CookingTip/FoodAcademy only ever consume
already-Published content.

## 1. Author: a real `BlogAuthor` model, not a free-text field

Food Academy (STORY-020) deliberately used a plain `authorName` string with no
`Author`/`User` model, because attribution there is a nice-to-have detail on
an entry. Blog is different: the AC requires filtering the listing *by
author* (`/blog?author=...`), an author bio block on the detail page, and the
user story is explicitly "follow the... voices I'm most interested in" — an
author is a first-class, browsable entity here, not a caption. So `BlogAuthor`
gets its own model (`id`, `name`, `slug`, `bio`, `avatarUrl`), the same shape
`RecipeCategory`/`FoodAcademyCategory` use for a filterable facet.

No `User`/admin-auth FK yet (none exists for content authors project-wide,
per Food Academy decision #2's identical reasoning) — `BlogAuthor` is its own
seed-authored table, not a login-linked account.

## 2. Body content: markdown, extended with a recipe/video shortcode

`bodyContent` is markdown, rendered through the same shared `<MarkdownContent>`
component Food Academy built (`src/components/shared/markdown-content.tsx`) —
one markdown pipeline for the whole codebase, no `rehype-raw`, XSS-safe by
construction.

The AC additionally requires "embedded... recipe/video blocks" inline in the
body. Rather than a second content format, `<MarkdownContent>` gains one new
capability: a custom remark syntax recognizing `[[recipe:<slug>]]` and
`[[video:<url>]]` tokens on their own line, replaced with the real
`RecipeCard` (looked up by slug, Published-only — silently omitted if the
slug doesn't resolve to a Published recipe, never a broken card) or a
`VideoPlayer` (STORY-019's component, reused as-is). This is additive to
`<MarkdownContent>`'s existing `components` map; every other page already
using `<MarkdownContent>` (Food Academy) is unaffected unless its content
happens to contain the token syntax, which none of its seed data does.

Implementation: a small remark plugin (`remarkEmbeds`, colocated with
`markdown-content.tsx`) that turns a paragraph consisting solely of
`[[recipe:slug]]` or `[[video:url]]` into a custom MDAST node type
(`blogEmbedRecipe` / `blogEmbedVideo`), which `<MarkdownContent>`'s
`components` map renders as `<RecipeCard>` / `<VideoPlayer>`. Because
`<MarkdownContent>` is shared, it needs a way to resolve a recipe slug to
actual `RecipeCard` props — it takes an optional `resolveRecipeCard` async
data map (pre-fetched by the calling page, not fetched by the renderer
itself, keeping `<MarkdownContent>` a synchronous, pure Server Component with
no data-fetching of its own). The blog detail page's `getPostBySlug` service
call extracts every `[[recipe:slug]]` token from `bodyContent`, resolves them
in one batch via the existing `getRecipesByIds`-style helper (new:
`getRecipeCardsBySlugs`, Published-only), and passes the resulting map down.

## 3. Post status: `Draft → Scheduled → Published → Archived`, with a live-clock guard

Unlike every prior content type's two-value `Draft/Published` status, blog
posts support **scheduling**: a post can be `Published` in the database with
a future `publishedAt`, and must not appear on the storefront until that
timestamp passes. This is a new invariant layered on top of the familiar
one: every published-facing query composes
`AND: [{ status: "Published" }, { publishedAt: { lte: new Date() } }, restWhere]`,
stripping any caller-supplied `status`/`publishedAt` first — same
non-negotiable discipline as Food Academy's `status`-stripping, extended to
a second field because a scheduled-future post is exactly as real a leak as
a Draft one.

`Scheduled` as a *status value* is mostly informational/future-admin-UI
sugar (Epic 07's Admin Blog Editor sets an explicit `Scheduled` status when
an editor schedules a post, per the Tasks list) — the storefront's actual
gate is `status: "Published" AND publishedAt <= now()`, so a `Draft` post
with a past `publishedAt` (a bad manual edit) still correctly never
appears, and a `Scheduled` post's own status never needs to independently
gate anything: the same `Published`-only check already excludes it. This
means storefront queries never need to special-case `Scheduled` — one
`status: "Published"` check, plus the date guard, is sufficient. Documented
here so a future admin implementer isn't tempted to add a second query
branch for `Scheduled`.

## 4. Comment lifecycle: mirrors `review.service.ts`'s state machine exactly

`review.service.ts`'s `Pending → Approved → Published (→ Archived)` machine
(`canTransitionReview`, `changeReviewStatus`, a moderator-only transition
function Epic 07 calls) is the precedent. `BlogComment` needs one fewer
public-facing state (`APPROVED` *is* the visible state; blog comments don't
have Review's separate "Approved but not yet Published" step, since there's
no Published-with-recalculated-rating step for comments to wait on):

```
Pending → Approved   (visible)
Pending → Rejected   (never visible)
Approved → Hidden    (was visible, retracted)
```

`canTransitionComment`/`changeCommentStatus` in `blog.service.ts` follow the
review precedent's shape exactly (an `allowedTransitions` table, a single
mutation function, called only by this story's own seed/dev-tooling
`advanceCommentToApproved` helper for now — Epic 07's moderation console is
the only future caller with real authority).

Every public comment-list query hardcodes `status: "Approved"`, same
AND-composition discipline as everywhere else. `submitComment` always
creates `status: "Pending"` and the API route never echoes the created row
back as if it were public — it returns a minimal
`{ status: "pending-review" }` acknowledgement, not the comment itself, so
there's no path (even a client-side optimistic-update mistake) where the
unapproved comment could render as public.

## 5. Comment identity and spam guard

Unlike Reviews/Q&A (which require an authenticated `userId` — no guest
path), the AC explicitly allows guest commenting: "name/email or
authenticated customer". `submitComment`'s input is `{ name, email, body,
honeypot }` when no session exists, or `{ body, honeypot }` when one does
(name/email are read server-side from the session, never trusted from the
client even if a signed-in user's form happened to submit them — the
service ignores any client-supplied name/email whenever `customerId` is
present).

Shared Zod schema (`blogCommentInputSchema`, `src/validation/blog.schema.ts`)
used by both `BlogCommentForm` (RHF, `zodResolver`) and the route handler,
same pattern as `newsletter.schema.ts`: `name`/`email` `.optional()` at the
schema level (required-ness is enforced in the service based on session
presence, not in the shared schema, since the schema can't see the session),
`body` min 3 / max 2000 chars, `honeypot: z.string().max(0)` (any non-empty
value fails validation — silently, same generic "thanks" response either
way, so a bot never learns the check exists).

Rate limit: no new infrastructure. Before inserting, `submitComment` checks
for an existing `BlogComment` on the same `postId` with the same
`authorEmail` (or `customerId`) created within the last 60 seconds, and
silently no-ops (still returns the same "submitted" acknowledgement — never
reveals the throttle to a caller) if found. One indexed query against the
table the comment would go into anyway; no queue, no Redis, no
new dependency.

## 6. Data model

```prisma
enum BlogPostStatus {
  Draft
  Scheduled
  Published
  Archived
}

enum BlogCommentStatus {
  Pending
  Approved
  Rejected
  Hidden
}

model BlogAuthor {
  id        String     @id @default(cuid())
  name      String
  slug      String     @unique
  bio       String?
  avatarUrl String?
  posts     BlogPost[]
}

model BlogTag {
  id    String        @id @default(cuid())
  name  String
  slug  String        @unique
  posts BlogPostTag[]
}

model BlogPost {
  id                 String             @id @default(cuid())
  slug               String             @unique
  title              String
  heroImageUrl       String?
  excerpt            String
  bodyContent        String
  authorId           String
  author             BlogAuthor         @relation(fields: [authorId], references: [id])
  readingTimeMinutes Int?
  status             BlogPostStatus     @default(Draft)
  publishedAt        DateTime?
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  tags     BlogPostTag[]
  comments BlogComment[]

  @@index([status, publishedAt])
  @@index([status, authorId])
}

model BlogPostTag {
  id     String   @id @default(cuid())
  postId String
  post   BlogPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  tagId  String
  tag    BlogTag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@unique([postId, tagId])
  @@index([tagId])
}

model BlogComment {
  id          String            @id @default(cuid())
  postId      String
  post        BlogPost          @relation(fields: [postId], references: [id], onDelete: Cascade)
  authorName  String
  authorEmail String
  customerId  String?
  customer    User?             @relation(fields: [customerId], references: [id])
  body        String
  status      BlogCommentStatus @default(Pending)
  createdAt   DateTime          @default(now())

  @@index([postId, status])
  @@index([postId, authorEmail, createdAt])
}
```

`customerId` is a real, optional FK to `User` (`customerId String?` +
`customer User? @relation(fields: [customerId], references: [id])`),
matching how Reviews/Q&A already relate a submission to its logged-in
author (`userId` → `User`). The FK costs nothing extra and keeps a
logged-in commenter's identity queryable and consistent with the rest of
the codebase — unlike `BlogPost.authorId` (a content author, which has no
`User` account to reference), a customer submitting a comment already has
one.

## 7. Repository → Service → API layering

`blog.repository.ts` (only file importing Prisma for this module):
- `findPublishedBlogPosts({ where, skip, take })` — the `AND`-composed,
  status+date-guarded, caller-status-stripped query, mirroring
  `findPublishedFoodAcademyEntries` exactly.
- `findPublishedBlogPostBySlug(slug)` — same guard, includes approved
  comments (ordered `createdAt asc`), tags, author.
- `findRelatedBlogPosts(post, limit)` — same-tag-or-author first, **then
  fall back to other recent Published+past-date posts** to top up to
  `limit` when same-tag/author results run short. This fallback was a real
  bug in Food Academy's first cut (caught in its final review) — designed
  in from the start here instead of waiting to rediscover it.
- `findActiveBlogTags()` / `findActiveBlogAuthorsWithPublishedPosts()` — the
  latter mirrors Food Academy's post-final-review fix
  (`entries: { some: { status: "Published" } }`): an author with zero
  Published posts must never appear as a filter chip, from day one.
- `createBlogComment(data)` — always `status: "Pending"`.
- `findRecentCommentByAuthor(postId, identity, sinceDate)` — the rate-limit
  check.
- `changeCommentStatus(commentId, nextStatus)` — the moderation primitive
  Epic 07 will call; unused by any route in this story except the seed/dev
  helper.

`blog.service.ts`:
- `listPosts(filters, pagination)`, `listTags()`, `listAuthors()`,
  `getPostBySlug(slug)` (resolves `[[recipe:slug]]` tokens via
  `getRecipeCardsBySlugs`, folds in related posts), `submitComment(postId,
  input, session)` (session-aware identity resolution, honeypot check,
  rate-limit check, always creates `Pending`).

API:
- `GET /api/blog` — `tag`, `author`, `page`, `pageSize`.
- `GET /api/blog/[slug]` — 404 for missing/Draft/Scheduled/future-dated.
- `POST /api/blog/[slug]/comments` — 200 with `{status:"pending-review"}` on
  success (including the silent honeypot/rate-limit no-op path), 404 if the
  post itself doesn't resolve, 400 on real validation failure.

## 8. Frontend structure

`/blog` (Server Component): tag and author filter `<nav>`s where **each
chip link preserves the other filter's current value** (a real Food
Academy bug — its category/contentType chips each dropped the other on
click — fixed there post-review, designed correctly here from the start:
every chip's `href` is built from the full current query, only overwriting
its own param). Numbered pagination (prev/next + page-number links,
`aria-current="page"` on exactly one link at a time) using the existing
`page`/`pageSize` contract, with the total count rendered next to the
results heading.

`/blog/[slug]`: `generateMetadata` + `BlogPosting` JSON-LD
(`FoodAcademyJsonLd`'s pattern, generalized), breadcrumbs, hero image,
author bio block (avatar + bio + link to `/blog?author=slug`), tags,
`<MarkdownContent>` with the embed resolution map, a `RelatedPosts` block
(same card component as the listing), then the comment section.

Comment section: `BlogCommentList` (Server Component, renders only
`Approved` comments already included in `getPostBySlug`'s payload) +
`BlogCommentForm` (the one Client Component this story adds — RHF + Zod,
honeypot field visually hidden via CSS rather than `type="hidden"` so a
bot's naive form-fill still trips it, `aria-hidden` + `tabIndex={-1}` so it
never confuses a real keyboard/screen-reader user). On successful submit,
the form replaces itself with a "Thanks — your comment is awaiting
approval" message; it never appends the submitted comment to the visible
list.

## 9. SEO and structured data

`generateMetadata` on the detail page: title, excerpt as description,
`alternates.canonical`. `BlogPosting` JSON-LD: `headline`, `description`,
`image`, `datePublished` (`publishedAt`), `author: { "@type": "Person",
name }`. The listing page gets `ItemList` JSON-LD, same as Food
Academy's hub.

## 10. Accessibility floor

Comment form: every field has a visible `<Label>`, validation errors are
associated via `aria-describedby` and announced (not color-only), the
honeypot field is unreachable by keyboard/AT (`aria-hidden`, `tabIndex={-1}`,
visually hidden via clip/absolute positioning, not `display:none` — some
bots skip `display:none` fields, so this is deliberately the more robust
hiding technique, not just cosmetic). Filter chip navs get `aria-current`
exactly as Food Academy's (corrected) pattern. Pagination links are real
`<a>`s (keyboard-operable for free), with `aria-current="page"` on the
active one and an accessible label distinguishing prev/next from
page-number links.

## 11. Testing plan

Unit: `blog.repository.ts`/`blog.service.ts` — Published+past-date
filtering (Draft, Scheduled-future, and a `Published`-but-future-dated post
all excluded; a `Published`-and-past-dated one included), the
author/tag-filter-requires-a-Published-post invariant, the related-posts
fallback, comment-status transitions (mirroring
`review-service.test.ts`'s transition-table test shape), honeypot
rejection, rate-limit no-op, and the markdown embed-token resolution
(`[[recipe:slug]]` → real `RecipeCard` props; unresolvable slug → token
silently dropped, not a broken embed).

Playwright e2e: browse `/blog`, filter by tag and by author (combinable,
URL reflects both), paginate, open a post with an embedded recipe/video and
confirm it renders as a real card/player (not literal `[[...]]` text),
submit a comment and confirm the "awaiting approval" state, confirm the
comment does not appear in the public list on reload, confirm a
future-scheduled post's slug 404s. Axe scans on the listing, a detail page,
and the comment form specifically.
