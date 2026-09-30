# STORY-044: Admin Blog Editor

**Status:** Core landed (2026-09-30) — see `docs/architecture-decisions.md`'s 2026-09-30 STORY-044 entry for the full write-up, including the markdown-editor decision, the Scheduled-is-derived-not-stored design (with the seed-blog.ts evidence), the BlogAuthor-vs-AdminUser split, the Spam/Reply deferrals to STORY-045, and the autosave/related-content deferrals.
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Content Editor, SEO Specialist, Marketing Manager, Super Administrator

## User Story
As a Content Editor, I want a rich text editor to author, schedule, and tag blog posts with an assigned author, so that I can publish brand storytelling content on a regular cadence without developer help.
As a Content Editor, I want to moderate comments submitted on blog posts, so that public discussion under our content stays on-brand and free of spam.

## Description
This story delivers the Blog console module from `docs/blueprint.md` Section 7 ("rich text editor, scheduling, authors, tags, comment moderation"). It is the admin authoring and moderation counterpart to the customer-facing blog defined in STORY-021, which had shipped a full storefront read path and a comment-submission/moderation-transition service with no admin write surface at all. **Deviation:** built as a markdown editor over `BlogPost.bodyContent` (already plain markdown with `[[recipe:slug]]`/`[[video:url]]` embeds) rather than a WYSIWYG/structured-JSON editor, and with its own lightweight Draft/Published/Archived lifecycle rather than plugging into STORY-053 (which doesn't exist yet) — see the architecture-decisions entry for the full reasoning.

## Acceptance Criteria
- [x] A markdown editor (**Deviation:** not WYSIWYG — see Description) supports headings, inline formatting (bold/italic/heading/link/list/blockquote via a toolbar), images (inserted via the Media Library's `AssetPickerDialog`) and recipe/video embeds, with a live Preview toggle rendering through the real storefront `MarkdownContent` component. Content persists as markdown (unchanged from STORY-021's existing format), not a structured JSON document.
- [x] Post metadata includes: title, slug, excerpt, featured image, assigned author (a `BlogAuthor` — the existing curated public byline, unchanged from STORY-021; **Deviation:** not "any admin user" — see Description), tags, and SEO fields (meta title/description/OG image, newly added to `BlogPost`)
- [x] A post can be saved as Draft, or published (optionally with a future date/time to schedule) via one Publish action — the Publish dialog's date picker serves both "publish now" (today) and "schedule" (a future date) cases
- [x] Post status follows Draft → Scheduled → Published(Live) → Archived. **Deviation:** `Scheduled` is a computed display label (`deriveEffectiveStatus`, `src/lib/blog-post-status.ts`), never a stored `BlogPostStatus` value — confirmed via `src/` grep that the codebase never wrote or read the literal `"Scheduled"` value before this story either; no STORY-053 workflow engine (doesn't exist yet), this story's own `Draft ↔ Published ↔ Archived` transitions live in `blog-admin.service.ts`
- [x] A comment moderation queue (`/admin/blog/comments`) lists comments per post/status with Approve, Reject, Hide, and Delete actions. **Deviation:** no separate spam flag (folds into Reject — `BlogCommentStatus` has no fifth value) and no Reply action (needs new fields/threading; explicitly deferred to STORY-045's own unified console, which already expects to reuse this story's comment service rather than duplicate it)
- [x] Bulk approve/reject is available on a filtered/selected set of comments, reporting which ids actually updated vs. were skipped (stale/already-transitioned)
- [x] The rendered post byline shows the assigned author's name, sourced from `BlogAuthor` (unchanged, already worked from STORY-021)
- [ ] **Deferred** (see architecture-decisions entry): periodic autosave — no other admin form in this codebase autosaves; explicit Save only, consistent with Product/Recipe/Homepage-Builder

## Tasks
- [x] **Database:** Added to `BlogPost`: `metaTitle`/`metaDescription`/`ogImage` (`String?`, matching Product/Recipe's field names), `createdById`/`updatedById` (`AdminUser?`, `onDelete: SetNull`). **Deviation:** no `bodyJson` (stays markdown `String`), no `scheduledAt` (see Scheduled-is-derived above), no `BlogCommentStatus.SPAM` value, no new tables — `BlogTag`/`BlogComment` already existed from STORY-021.
- [x] **API:** `/api/admin/blog/posts` (list/create), `/posts/[id]` (get/update/delete), `/posts/[id]/publish` (body: `{ publishedAt? }`), `/archive`, `/restore`, `/posts/reference-data`; `/api/admin/blog/comments` (list+filters), `/comments/[id]/approve`, `/reject`, `/hide`, `/delete`, `/comments/bulk`. **Deviation:** no `/schedule` endpoint (folded into `/publish`).
- [x] **Service/Backend:** `blog-admin.service.ts` — post CRUD/publish/archive/restore with `requirePermission`+`writeAuditLog` on every mutation; `approveComment`/`rejectComment`/`hideComment`/`deleteComment`/`bulkModerateComments` as thin wrappers around `blog.service.ts`'s pre-existing `canTransitionComment`/`changeCommentStatus` (STORY-021), not a reimplementation. **Deviation:** no delegation to STORY-053 (doesn't exist); no separate `comment-moderation.service.ts` (kept in `blog-admin.service.ts`, small enough not to warrant a split yet).
- [x] **Frontend:** `src/app/(admin)/admin/blog/posts/page.tsx` (list + Draft/Scheduled/Live/Archived filter), `posts/new` + `posts/[id]` + `admin-blog-post-form.tsx` (tabbed builder: Details / Body / Media / SEO; `blog-body-editor.tsx` is the markdown textarea + toolbar + preview), `posts/[id]/preview` (admin-only, any-status, reuses the real storefront `BlogPostBody`/`MarkdownContent`/`RecipeCard` components), `src/app/(admin)/admin/blog/comments/page.tsx` (moderation queue with bulk actions).
- [x] **Validation:** `blog-admin.schema.ts` — post fields, `publishBlogPostSchema` (`{ publishedAt? }`), list-query schemas, `bulkModerateCommentsSchema`.
- [x] **Testing:** `tests/unit/blog-admin-service.test.ts` (15 tests — post CRUD/publish/archive/restore/delete/permissions, comment moderation transitions/bulk/permissions). `tests/e2e/admin-blog.spec.ts` (3 tests — full author→publish→storefront flow with a resolved recipe embed and comment moderation; a scheduled post absent from the storefront; Viewer-only permission check). **Deviation:** no autosave-debounce test (feature deferred).
- [x] **Documentation:** `docs/architecture-decisions.md`'s 2026-09-30 STORY-044 entry covers every deviation above plus the reading-time computation and a real environment issue (corrupted Turbopack dev cache after a forced process kill) found and fixed while verifying this story.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-021 (Blog) — the storefront read path, comment transition service, and markdown body format this story authors into
- STORY-041 (Media Library) — post images via `AssetPickerDialog`
- ~~STORY-053 (CMS Workflow & Versioning)~~ — **not used**; this module's Draft/Published/Archived lifecycle is built directly on `BlogPost.status` (see Description)

## References
- `docs/blueprint.md` Section 7 ("Blog" console module bullet)
- `docs/blueprint.md` Section 4/5 (blog content requirements)
