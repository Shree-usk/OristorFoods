# STORY-021: Blog

**Status:** Draft
**Epic:** 04 — Recipes & Food Academy
**Priority:** Medium
**Persona(s):** Home Cook, Sri Lankan Expat, Gourmet Food Enthusiast

## User Story
As a Gourmet Food Enthusiast, I want to browse blog posts by tag and author, so that I can follow the topics and voices I'm most interested in.
As a Home Cook, I want to read a blog post and leave a comment, so that I can engage with the brand and other readers.
As a Sri Lankan Expat, I want to page through older blog posts, so that I can catch up on brand stories and content I missed.

## Description
This story builds the customer-facing Blog named in `docs/blueprint.md` Section 4 (primary nav "Blog") and Section 5 ("Content: ...blog..."). It covers the blog listing page (filterable by tag and author, paginated) and the blog post detail page, including a public comment submission and display experience. Comment *moderation* (approve/reject/reply/feature/hide, per Section 7's "Blog — rich text editor, scheduling, authors, tags, comment moderation") is an Admin epic concern and is referenced here only as a dependency/data contract, not implemented in this story.

## Acceptance Criteria
- [ ] `/blog` renders a paginated list of published blog posts, each card showing featured image, title, excerpt, author, publish date, and tags
- [ ] Customers can filter the blog list by tag (`/blog?tag=...`) and by author (`/blog?author=...`), with combinable filters reflected in the URL
- [ ] Pagination (page-number or load-more) works correctly with filters applied, and total post count is shown
- [ ] `/blog/[slug]` renders a single published post: title, hero image, author bio block, publish date, tags, rich-text body content (supporting embedded images and, where present, embedded recipe/video blocks), and estimated reading time
- [ ] Only posts with `status = PUBLISHED` and a `publishedAt` in the past are ever returned to the storefront; scheduled-but-future posts are excluded until their publish time passes
- [ ] A "related posts" block shows other posts sharing tags/author
- [ ] Blog post detail page includes a public comment section: a comment submission form (name/email or authenticated customer, comment body) and a list of previously approved comments
- [ ] Submitted comments are created with a `PENDING` status and are **not** shown publicly until an admin approves them via the moderation console (STORY-044/045 in Epic 07) — the submitter sees a "your comment is awaiting approval" confirmation state
- [ ] Comment submission is rate-limited/spam-guarded at minimum with honeypot or equivalent basic protection (full spam/abuse tooling is not required here)
- [ ] Blog pages include SEO meta tags and `Article`/`BlogPosting` structured data
- [ ] Listing and detail pages are fully responsive and meet WCAG 2.1 AA (accessible comment form labels/errors, readable tag/author filter controls)
- [ ] Meets Lighthouse >95 with server-rendered initial content for listing and detail pages

## Tasks

- [ ] **Database:**
  - [ ] Define `BlogPost` model: `id`, `slug`, `title`, `heroImageUrl`, `excerpt`, `bodyContent` (rich text), `authorId`, `status` (DRAFT/SCHEDULED/PUBLISHED/ARCHIVED), `publishedAt`, `readingTimeMinutes`, `createdAt`, `updatedAt`
  - [ ] Define `BlogAuthor` model: `id`, `name`, `slug`, `bio`, `avatarUrl`
  - [ ] Define `BlogTag` model and `BlogPostTag` join table (many-to-many)
  - [ ] Define `BlogComment` model: `id`, `postId`, `authorName`, `authorEmail`, `customerId` (nullable FK if submitted by a logged-in customer), `body`, `status` (PENDING/APPROVED/REJECTED/HIDDEN), `createdAt`
  - [ ] Add indexes on `BlogPost.status`, `BlogPost.publishedAt`, `BlogPost.slug` (unique), `BlogComment.postId` + `status`
  - [ ] Migration + seed data: several authors, a tag set, 10+ published posts (including at least one scheduled-future post to verify exclusion), and a mix of pending/approved seed comments

- [ ] **API:**
  - [ ] `GET /api/blog` — list endpoint with `tag`, `author`, `page`/`pageSize` params, published-and-past-`publishedAt` only
  - [ ] `GET /api/blog/[slug]` — single post detail (with approved comments, tags, author, related posts), 404 for missing/non-published/future-scheduled slugs
  - [ ] `POST /api/blog/[slug]/comments` — creates a `BlogComment` with `status = PENDING`; does not return it in any subsequent public GET until an admin flips it to `APPROVED`

- [ ] **Service/Backend:**
  - [ ] `blog.service.ts`: `listPosts(filters, pagination)`, `getPostBySlug(slug)`, `getRelatedPosts(postId)`, `submitComment(postId, input)`
  - [ ] `blog.repository.ts`: Prisma queries (only file allowed to import Prisma directly), including the `publishedAt <= now()` guard applied consistently across list and detail queries
  - [ ] Comment submission service enforces basic spam guard (honeypot field check, simple rate limit by IP/session) before persisting as `PENDING`

- [ ] **Frontend:**
  - [ ] `src/app/(storefront)/blog/page.tsx` — Server Component list page with tag/author filter chips
  - [ ] `src/app/(storefront)/blog/[slug]/page.tsx` — detail page with `generateMetadata` and `BlogPosting` structured data
  - [ ] `src/components/storefront/blog/BlogPostCard.tsx`, `BlogTagFilter.tsx`, `BlogAuthorFilter.tsx`, `BlogPagination.tsx`, `BlogCommentForm.tsx` (Client Component, React Hook Form + Zod), `BlogCommentList.tsx`, `RelatedPosts.tsx`
  - [ ] Comment form shows a clear "submitted, awaiting approval" success state after posting (no optimistic display of the unapproved comment as if it were public)

- [ ] **Validation:**
  - [ ] Zod schema for `/api/blog` query params
  - [ ] Zod schema for comment submission payload (name/email format, body min/max length, honeypot field must be empty), shared between the React Hook Form client validation and the API route validation

- [ ] **Testing:**
  - [ ] Unit tests for `blog.repository.ts`/`blog.service.ts` published+past-date filtering (future-scheduled and draft posts excluded)
  - [ ] Unit tests for comment submission producing `PENDING` status and never appearing in the public comment list pre-approval
  - [ ] Playwright e2e: browse `/blog`, filter by tag and author, open a post, submit a comment and confirm the "awaiting approval" state, confirm the comment does not appear in the public list
  - [ ] Accessibility test pass (axe) on the comment form and tag/author filters

- [ ] **Documentation:**
  - [ ] Document the `BlogComment` status lifecycle (`PENDING → APPROVED/REJECTED/HIDDEN`) in `docs/architecture-decisions.md`, explicitly noting that the moderation UI is owned by Epic 07's Admin Blog Editor / Reviews Moderation Console stories
  - [ ] Document the scheduled-publish (`publishedAt` in the future) contract so the future Admin Blog Editor scheduling feature writes data this story already respects correctly

## Dependencies
- STORY-001 (Project Foundation Setup)
- STORY-002 (Design System & Theming)
- STORY-003 (Global Layout & Responsive Framework)
- Epic 07 STORY-044 (Admin Blog Editor) / STORY-045 (Reviews Moderation Console) — comment moderation (approve/reject/reply/feature/hide) is implemented there; this story only produces `PENDING` comments and renders `APPROVED` ones

## Out of Scope
- Comment moderation UI (approve/reject/reply/feature/hide) — Epic 07
- Blog post authoring/rich-text editor and scheduling UI — Epic 07 ("Admin Blog Editor")
- Advanced anti-spam/abuse tooling beyond a basic honeypot/rate-limit guard
- Social sharing analytics or comment upvoting (not specified in the blueprint)

## References
- `docs/blueprint.md` Section 4 (Site Structure — primary nav "Blog")
- `docs/blueprint.md` Section 5 (Content: blog)
- `docs/blueprint.md` Section 7 (Admin Console — "Blog — rich text editor, scheduling, authors, tags, comment moderation")
- `docs/blueprint.md` Section 9 item 4 (Recipes & Food Academy)
- `docs/folder-structure.md`
